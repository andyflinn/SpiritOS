'use strict';

// Shared by relay.js (verify) and hub.js (sign). Node crypto only.
// Files live on that process's spirit/run home, never in git:
//   relay-state/allow.json     { "names": [...] }  OR  { "keys": [{ "name", "publicKey" }] }
//   relay-state/identity.json  { "name", "publicKey", "privateKey" }

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function claimMessage(name) {
  return 'claim\n' + name;
}

function sendMessage(from, to, text) {
  return 'send\n' + from + '\n' + to + '\n' + text;
}

// Reading a mailbox is as much a capability as writing to one. claim and
// send were signature-gated from the start while inbox took a bare name
// and handed over that peer's messages to anyone who asked — so on a relay
// where every write was cryptographically proven, every read was still
// anonymous, and any name was enough to drain someone's mail.
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

function loadIdentity(rootDir) {
  try {
    const raw = fs.readFileSync(path.join(rootDir, 'relay-state', 'identity.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.name && parsed.privateKey) return parsed;
  } catch (e) { /* none */ }
  return null;
}

function checkClaim(allow, name, sig) {
  if (!name) return { ok: false, status: 400, error: 'name required' };
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

// Same shape as checkClaim: open and names mode have no key to verify
// against, so they stay as permissive as they already are for claim/send.
// Keys mode is where the guarantee is real.
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

module.exports = {
  claimMessage,
  sendMessage,
  inboxMessage,
  checkInbox,
  generateIdentity,
  sign,
  verify,
  loadAllow,
  loadIdentity,
  checkClaim,
  checkSend,
};
