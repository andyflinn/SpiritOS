'use strict';

// Shared by relay.js (verify) and hub.js (sign). Node crypto only.
// Files live on that process's spirit/run home, never in git:
//   relay-state/allow.json     { "names": [...] }  OR  { "keys": [{ "name", "publicKey", "devicePublicKey"? }] }
//   relay-state/identity.json  { "name", "publicKey", "privateKey" }

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// The device slot's shape and the one parser for an allow row. deviceAuth
// requires nothing from here, so this is a one-way edge: the module that
// owns the personal node's password also owns how a device key is spelled
// in a mailbox's allow list, and there is one answer to that question.
const deviceAuth = require('./deviceAuth');

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
//
// The bytes carry the minute they were made in, because without one the
// signature is a permanent read token: `inbox\n<label>` never changes, it
// travelled in the query string, and a query string is written to every
// access log a request passes through. One line of a proxy log was a
// standing licence to drain that mailbox, with no way to revoke it short
// of changing the key.
//
// `unix-minute` is decimal and unpadded. The window below is what makes a
// captured line die on its own.
function inboxMessage(name, atMs) {
  var minute = Math.floor((atMs == null ? Date.now() : atMs) / 60000);
  return 'inbox\n' + name + '\n' + minute;
}

// Previous, current and next: enough for two clocks a minute apart, and
// short enough that a captured signature is worthless before anybody has
// finished reading the log it landed in. Next as well as previous,
// because the SIGNER may be the one running fast.
function inboxSignatureOk(publicKey, token, sig, atMs) {
  if (!publicKey || !sig) return false;
  var now = atMs == null ? Date.now() : atMs;
  for (var step = -1; step <= 1; step += 1) {
    if (verify(publicKey, inboxMessage(token, now + step * 60000), sig)) return true;
  }
  return false;
}

// ITS OWN VERB, and that is the point of it. The owner signs `status` for
// every census and `inbox` every two seconds, so a captured signature is
// always available to somebody reading a log — and what this one opens is
// a STANDING grant rather than a single read, which makes it a far better
// prize than either. Same reason deviceGate gave `device-take` its own
// bytes.
//
// The token is a public KEY, not a label. Labels duplicate by design, so
// a signature naming one identifies nobody on a relay holding two johns
// (PEER-DEVICES.md, and B2 carried it inward).
function streamMessage(key, atMs) {
  var minute = Math.floor((atMs == null ? Date.now() : atMs) / 60000);
  return 'stream\n' + String(key || '') + '\n' + minute;
}

// Previous, current and next, exactly as inboxSignatureOk: enough for two
// clocks a minute apart, in both directions, because the SIGNER may be
// the one running fast.
function streamSignatureOk(publicKey, key, sig, atMs) {
  if (!publicKey || !sig) return false;
  var now = atMs == null ? Date.now() : atMs;
  for (var step = -1; step <= 1; step += 1) {
    if (verify(publicKey, streamMessage(key, now + step * 60000), sig)) return true;
  }
  return false;
}

// FORGETTING SOMEBODY IS ITS OWN VERB, for the reason every other one
// is: the owner signs `status` for each census and `invite` whenever they
// add a member, and neither of those may be replayable as "delete this
// person". Removal is the only owner action that destroys, so it is the
// one that least deserves a shared signature.
//
// The key, not the label. Labels duplicate by design, so a signature
// naming one would be an instruction to remove whichever john the relay
// happened to find first.
function removePeerMessage(key, atMs) {
  var minute = Math.floor((atMs == null ? Date.now() : atMs) / 60000);
  return 'remove-peer\n' + String(key || '') + '\n' + minute;
}

function removePeerSignatureOk(publicKey, key, sig, atMs) {
  if (!publicKey || !sig) return false;
  var now = atMs == null ? Date.now() : atMs;
  for (var step = -1; step <= 1; step += 1) {
    if (verify(publicKey, removePeerMessage(key, now + step * 60000), sig)) return true;
  }
  return false;
}

// A REQUEST, and the hash is taken over exactly these bytes — which are
// exactly the bytes that were signed. That binding is deliberate: there
// is then no question about what the hash covers, and no canonical-JSON
// rule for two implementations to disagree about.
//
// `from` and `to` are KEYS, not labels (B2). The requester is inside the
// hashed bytes on purpose: it makes it impossible for two different
// senders to produce the same hash, which is the first of the three
// things that stop a false positive (ROUTER.md §4).
function postMessage(from, to, text, atMs) {
  var minute = Math.floor((atMs == null ? Date.now() : atMs) / 60000);
  return 'post\n' + String(from || '') + '\n' + String(to || '') + '\n' +
    minute + '\n' + String(text == null ? '' : text);
}

// Returns THE MESSAGE THAT VERIFIED, not a boolean — and that is the
// whole trick. The signature is accepted across ±1 minute, so three
// different strings could have produced it, and the hash must be taken
// over whichever one actually did. Recovering it here means the minute
// never has to be transmitted: the requester, the relay and the target
// each arrive at the same string by finding the one that checks out.
function postSignatureFor(publicKey, from, to, text, sig, atMs) {
  if (!publicKey || !sig) return '';
  var now = atMs == null ? Date.now() : atMs;
  for (var step = -1; step <= 1; step += 1) {
    var message = postMessage(from, to, text, now + step * 60000);
    if (verify(publicKey, message, sig)) return message;
  }
  return '';
}

// The name of a request, everywhere in the chain.
function requestHash(message) {
  return crypto.createHash('sha256').update(String(message || ''), 'utf8').digest('hex');
}

// "I received exactly those bytes." The hash is INSIDE the signed
// message rather than beside it: attached alongside a signature over
// something else, the relay could swap it (ROUTER.md §2).
function receiptMessage(hash, atMs) {
  var minute = Math.floor((atMs == null ? Date.now() : atMs) / 60000);
  return 'receipt\n' + String(hash || '') + '\n' + minute;
}

function receiptSignatureOk(publicKey, hash, sig, atMs) {
  if (!publicKey || !sig) return false;
  var now = atMs == null ? Date.now() : atMs;
  for (var step = -1; step <= 1; step += 1) {
    if (verify(publicKey, receiptMessage(hash, now + step * 60000), sig)) return true;
  }
  return false;
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
      // The device slot rides alongside rather than inside byName, which
      // stays the HOUSE key string and nothing else. Every existing
      // reader — firstOwner's reclaim test, mint, ownerName — asks it
      // "which key is this name's" and would get a different kind of
      // answer if it became a list. The keys branch below is where "or
      // the device" is spelled out, once, deliberately.
      const deviceByName = Object.create(null);
      parsed.keys.forEach(function (raw) {
        const row = deviceAuth.parseKeyRow(raw);
        if (!row) return;
        byName[row.name] = row.publicKey;
        deviceByName[row.name] = row.devicePublicKey;
      });
      return { mode: 'keys', byName: byName, deviceByName: deviceByName };
    }
    if (parsed && Array.isArray(parsed.names)) {
      return { mode: 'names', names: parsed.names };
    }
  } catch (e) { /* missing = open */ }
  return { mode: 'open' };
}

// A row carries devicePublicKey only when there is one. Writing `null`
// would be a different file for the same fact, and the reclaim path
// (becomeOwner) hands over a house key alone — an empty slot it invented
// on the way past is a slot nobody asked for.
function writeAllowKeys(rootDir, keys) {
  const dir = path.join(rootDir, 'relay-state');
  fs.mkdirSync(dir, { recursive: true });
  const rows = (keys || []).map(function (raw) {
    const row = deviceAuth.parseKeyRow(raw);
    if (!row) return null;
    const out = { name: row.name, publicKey: row.publicKey };
    if (row.devicePublicKey) out.devicePublicKey = row.devicePublicKey;
    return out;
  }).filter(Boolean);
  fs.writeFileSync(path.join(dir, 'allow.json'), JSON.stringify({ keys: rows }, null, 2));
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
  // Either key is this name. A device is Andy on a handheld, not a second
  // party: it gets no peer row and claims no label, because two rows
  // wearing one label make resolveParty ambiguous and the owner's own
  // inbox stops answering (DEVICE-CYCLE1.md, and the walk-through in
  // design/reviews/2026-09-10-owner-devices.md §4). So the second key
  // lives on the owner RECORD, and every gate that asked "is this the
  // owner's signature" now asks it of both strings.
  //
  // There is no lesser rung to put a device on. allow.json in keys mode
  // is the owner record — ownerName() is its first name, and nothing else
  // is ever written to it — so a device key is a full copy of the owner's
  // authority on this box. That is the decision, not an oversight.
  //
  // keysForName puts the house key first, so the ordinary case still
  // proves on the first try and the device costs a verify only when the
  // house key was not the signer.
  const sendKeys = deviceAuth.keysForName(allow, from);
  if (!sendKeys.length) return { ok: false, status: 403, error: 'from not allowed' };
  const sendProved = !!sig && sendKeys.some(function (pub) {
    return verify(pub, sendMessage(from, to, text), sig);
  });
  if (!sendProved) return { ok: false, status: 403, error: 'bad send signature' };
  return { ok: true };
}

// The peer resolved from the requested token carries a key of its own, so
// the proof runs against that key rather than against the allow list.
// `token` is whatever the caller asked for — a public label or a public
// key — and has to be the same string the signature was made over.
function checkInboxKey(publicKey, token, sig, atMs) {
  if (!publicKey) return { ok: false, status: 403, error: 'name not allowed' };
  // Missing and wrong are told apart, because they are different
  // mistakes: one is a caller that has not been updated, the other is a
  // signature that does not hold. Same status, no new family.
  if (!sig) return { ok: false, status: 403, error: 'inbox signature required' };
  if (!inboxSignatureOk(publicKey, token, sig, atMs)) {
    return { ok: false, status: 403, error: 'bad inbox signature' };
  }
  return { ok: true };
}

// Keyless mailbox: open and names relays have no per-peer key, so this
// falls back to the allow list exactly as claim and send do there. In keys
// mode a name with no key behind it is nobody's mailbox to read.
function checkInbox(allow, name, sig, atMs) {
  if (!name) return { ok: false, status: 400, error: 'name required' };
  // An open or names relay has no per-peer key to check against, so it
  // never asked for a signature and still does not. The window is a
  // property of the proof, not of the route.
  if (allow.mode === 'open' || allow.mode === 'names') return { ok: true };
  // Either key, as in checkSend. Kept as a predicate over the keys rather
  // than one message verified once, because a read is proved differently
  // from a send: inboxSignatureOk carries a time window that verify()
  // knows nothing about.
  const inboxKeys = deviceAuth.keysForName(allow, name);
  if (!inboxKeys.length) return { ok: false, status: 403, error: 'name not allowed' };
  if (!sig) return { ok: false, status: 403, error: 'inbox signature required' };
  const inboxProved = inboxKeys.some(function (pub) {
    return inboxSignatureOk(pub, name, sig, atMs);
  });
  if (!inboxProved) return { ok: false, status: 403, error: 'bad inbox signature' };
  return { ok: true };
}

function checkOwner(allow, name, sig) {
  if (allow.mode !== 'keys') {
    return { ok: false, status: 403, error: 'no owner key on this relay' };
  }
  // Either key, as in checkSend — this is the gate that makes a handheld
  // useful at all: the census, minting and the console all come through
  // here, and being the owner from a hotel room is the whole point of the
  // device slot.
  const ownerKeys = deviceAuth.keysForName(allow, name);
  if (!ownerKeys.length) return { ok: false, status: 403, error: 'not the owner' };
  const ownerProved = !!sig && ownerKeys.some(function (pub) {
    return verify(pub, statusMessage(name), sig);
  });
  if (!ownerProved) return { ok: false, status: 403, error: 'bad status signature' };
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
  inboxSignatureOk,
  streamMessage,
  streamSignatureOk,
  removePeerMessage,
  removePeerSignatureOk,
  postMessage,
  postSignatureFor,
  requestHash,
  receiptMessage,
  receiptSignatureOk,
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
