'use strict';

// Shared by relay.js (verify) and hub.js (sign). Node crypto only.
// Files live on that process's spirit/run home, never in git:
//   relay-state/allow.json     { "names": [...] }  OR  { "keys": [{ "name", "publicKey" }] }
//   relay-state/identity.json  { "name", "publicKey", "privateKey" }

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RESERVED_NAME = 'relay';

function claimMessage(name) {
  return 'claim\n' + name;
}

function sendMessage(from, to, text) {
  return 'send\n' + from + '\n' + to + '\n' + text;
}

function statusMessage(name) {
  return 'status\n' + name;
}

// Reading a mailbox is as much a capability as writing to one. claim and
// send were signature-gated from the start while inbox took a bare name
// and handed over that peer's messages to anyone who asked — so on a relay
// where every write was cryptographically proven, every read was still
// anonymous, and any name was enough to drain someone's mail. Peer-by-key
// re-opened that hole; this is the gate again, and checkInboxKey below is
// how it is enforced now that a peer carries a key of its own.
function inboxMessage(name) {
  return 'inbox\n' + name;
}

function generateIdentity(name) {
  const pair = crypto.generateKeyPairSync('ed25519');
  return {
    name: name,
    publicKey: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
}

function privateKeyFromB64(b64) {
  return crypto.createPrivateKey({
    key: Buffer.from(b64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
}

function publicKeyFromB64(b64) {
  return crypto.createPublicKey({
    key: Buffer.from(b64, 'base64'),
    format: 'der',
    type: 'spki',
  });
}

function sign(privateKeyB64, message) {
  return crypto.sign(null, Buffer.from(message, 'utf8'), privateKeyFromB64(privateKeyB64)).toString('base64');
}

function verify(publicKeyB64, message, sigB64) {
  try {
    return crypto.verify(
      null,
      Buffer.from(message, 'utf8'),
      publicKeyFromB64(publicKeyB64),
      Buffer.from(sigB64, 'base64')
    );
  } catch (e) {
    return false;
  }
}

function pendingOwnerPath(rootDir) {
  return path.join(rootDir, 'relay-state', 'pending-owner.json');
}

function loadPendingOwner(rootDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(pendingOwnerPath(rootDir), 'utf8'));
    if (parsed && typeof parsed.name === 'string' && parsed.name.trim()) {
      return parsed.name.trim();
    }
  } catch (e) { /* none */ }
  return null;
}

function clearPendingOwner(rootDir) {
  try { fs.unlinkSync(pendingOwnerPath(rootDir)); } catch (e) { /* already gone */ }
}

function writePendingOwner(rootDir, name) {
  const dir = path.join(rootDir, 'relay-state');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(pendingOwnerPath(rootDir), JSON.stringify({
    name: name,
    createdAt: new Date().toISOString(),
  }, null, 2));
}

function loadAllow(rootDir) {
  try {
    const raw = fs.readFileSync(path.join(rootDir, 'relay-state', 'allow.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.keys) && parsed.keys.length) {
      const byName = Object.create(null);
      parsed.keys.forEach(function (row) {
        if (row && row.name && row.publicKey) byName[row.name] = row.publicKey;
      });
      return { mode: 'keys', byName: byName };
    }
    if (parsed && Array.isArray(parsed.names)) {
      return { mode: 'names', names: parsed.names };
    }
  } catch (e) { /* missing = open */ }
  return { mode: 'open' };
}

function writeAllowKeys(rootDir, keys) {
  const dir = path.join(rootDir, 'relay-state');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'allow.json'), JSON.stringify({ keys: keys }, null, 2));
}

function loadIdentity(rootDir) {
  try {
    const raw = fs.readFileSync(path.join(rootDir, 'relay-state', 'identity.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.name && parsed.privateKey) return parsed;
  } catch (e) { /* none */ }
  return null;
}

function saveIdentity(rootDir, id) {
  const dir = path.join(rootDir, 'relay-state');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'identity.json'), JSON.stringify(id, null, 2));
}

function ensureIdentity(rootDir, name) {
  var existing = loadIdentity(rootDir);
  if (existing && existing.privateKey && existing.publicKey) return existing;
  var id = generateIdentity(name);
  saveIdentity(rootDir, id);
  return id;
}

function checkClaim(allow, name, sig) {
  if (!name) return { ok: false, status: 400, error: 'name required' };
  if (name === RESERVED_NAME) {
    return { ok: false, status: 400, error: 'name reserved' };
  }
  if (allow.mode === 'open') return { ok: true };
  if (allow.mode === 'names') {
    if (allow.names.indexOf(name) === -1) {
      return { ok: false, status: 403, error: 'name not allowed' };
    }
    return { ok: true };
  }
  const pub = allow.byName[name];
  if (!pub) return { ok: false, status: 403, error: 'name not allowed' };
  if (!sig || !verify(pub, claimMessage(name), sig)) {
    return { ok: false, status: 403, error: 'bad claim signature' };
  }
  return { ok: true };
}

function checkSend(allow, from, sig, to, text) {
  if (allow.mode === 'open') return { ok: true };
  if (allow.mode === 'names') {
    if (allow.names.indexOf(from) === -1) {
      return { ok: false, status: 403, error: 'from not allowed' };
    }
    return { ok: true };
  }
  const pub = allow.byName[from];
  if (!pub) return { ok: false, status: 403, error: 'from not allowed' };
  if (!sig || !verify(pub, sendMessage(from, to, text), sig)) {
    return { ok: false, status: 403, error: 'bad send signature' };
  }
  return { ok: true };
}

// The peer resolved from the requested token carries a key of its own, so
// the proof runs against that key rather than against the allow list.
// `token` is whatever the caller asked for — a public label or a public
// key — and has to be the same string the signature was made over.
function checkInboxKey(publicKey, token, sig) {
  if (!publicKey) return { ok: false, status: 403, error: 'name not allowed' };
  if (!sig || !verify(publicKey, inboxMessage(token), sig)) {
    return { ok: false, status: 403, error: 'bad inbox signature' };
  }
  return { ok: true };
}

// Keyless mailbox: open and names relays have no per-peer key, so this
// falls back to the allow list exactly as claim and send do there. In keys
// mode a name with no key behind it is nobody's mailbox to read.
function checkInbox(allow, name, sig) {
  if (!name) return { ok: false, status: 400, error: 'name required' };
  if (allow.mode === 'open' || allow.mode === 'names') return { ok: true };
  const pub = allow.byName[name];
  if (!pub) return { ok: false, status: 403, error: 'name not allowed' };
  if (!sig || !verify(pub, inboxMessage(name), sig)) {
    return { ok: false, status: 403, error: 'bad inbox signature' };
  }
  return { ok: true };
}

function checkOwner(allow, name, sig) {
  if (allow.mode !== 'keys') {
    return { ok: false, status: 403, error: 'no owner key on this relay' };
  }
  const pub = allow.byName[name];
  if (!pub) return { ok: false, status: 403, error: 'not the owner' };
  if (!sig || !verify(pub, statusMessage(name), sig)) {
    return { ok: false, status: 403, error: 'bad status signature' };
  }
  return { ok: true };
}

function ownerName(allow) {
  if (allow.mode !== 'keys') return null;
  var names = Object.keys(allow.byName);
  return names.length ? names[0] : null;
}

module.exports = {
  RESERVED_NAME,
  claimMessage,
  sendMessage,
  statusMessage,
  inboxMessage,
  generateIdentity,
  sign,
  verify,
  loadAllow,
  writeAllowKeys,
  loadIdentity,
  saveIdentity,
  ensureIdentity,
  checkClaim,
  checkSend,
  checkInbox,
  checkInboxKey,
  checkOwner,
  ownerName,
  loadPendingOwner,
  writePendingOwner,
  clearPendingOwner,
};
