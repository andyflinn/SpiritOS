'use strict';

// Shared by relay.js (verify) and hub.js (sign). Node crypto only.
// Files live on that process's spirit/run home, never in git:
//   relay-state/allow.json     { "keys": [{ "name", "publicKey" }] }, or absent = open
//   relay-state/identity.json  { "name", "publicKey", "privateKey" }
//
// TWO MODES, NOT THREE. `{ "names": [...] }` was a third and went on
// 2026-09-15 — see loadAllow. `devicePublicKey` was a third field on a
// key row and went on 2026-09-13 — see writeAllowKeys.

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

// statusMessage STOOD HERE — `'status\n' + name` — and it was the last
// signed format on this wire that named a LABEL rather than a key, and
// the only one carrying no clock. Deleted with `checkOwner` and
// `GET /api/relay/status` on 2026-09-15 (R3).
//
// Every format left here carries a minute: streamMessage, postMessage
// and receiptMessage all take `atMs` and are checked ±1. claimMessage
// does not, and is the exception that proves the rule — a claim is
// answered once, at a box you have no row on, and a registered hash is
// what stops a post being replayed rather than a clock.

// sendMessage AND inboxMessage STOOD HERE — the ring's two signed
// formats, deleted with it by R8 on 2026-09-15 and struck from the
// register in decision 0010.
//
//   sendMessage   'send\n<from>\n<to>\n<text>'    signed by LABEL
//   inboxMessage  'inbox\n<label>\n<unix-minute>' proved a read
//
// Worth recording what `inbox` cost to get right, because the lesson
// outlived the verb and is enforced two functions down. Reading a mailbox
// is as much a capability as writing to one: claim and send were
// signature-gated from the start while inbox took a bare name and handed
// over that peer's messages to anyone who asked. Peer-by-key re-opened
// the same hole. And the first fix was not enough either — `inbox\n<label>`
// never changed, it travelled in the query string, and a query string is
// written to every access log a request passes through, so one line of a
// proxy log was a standing licence to drain that mailbox with no way to
// revoke it short of changing the key. The minute in the bytes is what
// made a captured line die on its own.
//
// Both halves of that survive the verb: streamMessage below carries a
// minute for the same reason, and relay.streamSignatureFrom refuses a
// signature on the query outright.
//
// ITS OWN VERB, and that was the point of it. The argument was that the
// owner signed `status` constantly, for every census, so a captured
// signature was always lying around — and what a STREAM opens is a
// standing grant rather than a single read, which makes it the better
// prize. Same reason deviceGate gave `device-take` its own bytes.
//
// `status` is gone (R3, 2026-09-15) and the rule outlived it, which is
// the ordinary way of these: one verb, one format, no signature that
// works in two places. There is nothing left on this wire whose bytes
// could be replayed into a stream open.
//
// The token is a public KEY, not a label. Labels duplicate by design, so
// a signature naming one identifies nobody on a relay holding two johns
// (PEER-DEVICES.md, and B2 carried it inward).
function streamMessage(key, atMs) {
  var minute = Math.floor((atMs == null ? Date.now() : atMs) / 60000);
  return 'stream\n' + String(key || '') + '\n' + minute;
}

// Previous, current and next: enough for two clocks a minute apart, in
// both directions, because the SIGNER may be the one running fast. The
// ring's inboxSignatureOk had the same window for the same reason, and
// this is the only one of the pair left.
function streamSignatureOk(publicKey, key, sig, atMs) {
  if (!publicKey || !sig) return false;
  var now = atMs == null ? Date.now() : atMs;
  for (var step = -1; step <= 1; step += 1) {
    if (verify(publicKey, streamMessage(key, now + step * 60000), sig)) return true;
  }
  return false;
}

// removePeerMessage and removePeerSignatureOk STOOD HERE, under a note
// arguing that removal — the one owner action that destroys — least
// deserved a shared signature, and that it had to name the KEY because
// labels duplicate.
//
// Both claims were right and a post keeps both, for free: it binds
// sender, recipient and the exact text, carries a minute, and has its
// hash registered before anything is answered. Removal names a key
// because the packet says `key`. There is nothing left here to sign.
//
// Both ways in are packets now — the owner naming anybody, a peer naming
// themselves — see relay.answerSelf. Decision 0010.

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
      // A ROW IS A NAME AND A HOUSE KEY. `deviceByName` rode alongside
      // until 2026-09-13 and is gone: a relay keeps no device key, because
      // the binding between a device and its node is the NODE's (see
      // deviceAuth.js). A stale `devicePublicKey` in an allow.json written
      // by older code is read and dropped here, which is the migration.
      parsed.keys.forEach(function (raw) {
        const row = deviceAuth.parseKeyRow(raw);
        if (!row) return;
        byName[row.name] = row.publicKey;
      });
      return { mode: 'keys', byName: byName };
    }
    // NAMES MODE STOOD HERE — `{ "names": [...] }`, a list of labels
    // allowed to claim with no key behind any of them. Deleted on
    // 2026-09-15.
    //
    // Not because it was unused in principle but because NOTHING IN THE
    // TREE EVER WROTE ONE. `writeAllowKeys` is the only writer of this
    // file and it writes `keys`; first-claim-is-owner (decision 0003)
    // produces a keys-mode box and always did. A names-mode allow.json
    // could only arrive by hand, and the two gates that made it mean
    // anything — checkSend and checkInbox — went with the ring in the
    // same sitting, so what was left was a mode that could claim and do
    // nothing else.
    //
    // A relay upgrading in place that somehow holds one falls through to
    // `open` below. That is the honest reading rather than a silent
    // demotion: a list of bare names with no keys IS an open box with a
    // guest list, and open mode says so out loud at startup.
  } catch (e) { /* missing = open */ }
  return { mode: 'open' };
}

// A row is a name and a house key. It carried a devicePublicKey until
// 2026-09-13; anything still passing one has it dropped here, which is how
// the field leaves a live allow.json on the next write.
function writeAllowKeys(rootDir, keys) {
  const dir = path.join(rootDir, 'relay-state');
  fs.mkdirSync(dir, { recursive: true });
  const rows = (keys || []).map(function (raw) {
    const row = deviceAuth.parseKeyRow(raw);
    if (!row) return null;
    return { name: row.name, publicKey: row.publicKey };
  }).filter(Boolean);
  fs.writeFileSync(path.join(dir, 'allow.json'), JSON.stringify({ keys: rows }, null, 2));
}

// A KEY THAT CANNOT SIGN IS NOT AN IDENTITY.
//
// This used to check that `privateKey` was a non-empty string and stop
// there, so a torn or truncated identity.json loaded fine and threw
// ERR_OSSL_ASN1_NOT_ENOUGH_DATA at the first sign() — synchronously,
// inside an http handler, with nothing waiting to catch it. The node
// died. Found on 2026-09-13 by serverSurface.js's hub sweep, which was
// the first thing ever to call those routes against a booted process.
//
// Answering `null` is the fix rather than a try/catch at each signing
// site, because null is a state every caller ALREADY handles and handles
// well: "no identity on this node", said out loud, with a status. There
// were eleven signing sites and one of this.
//
// The parse is done once, here, and the result thrown away — crypto
// caches nothing for us, but a malformed key fails identically every
// time, so proving it once at load proves it for the process.
function loadIdentity(rootDir) {
  try {
    const raw = fs.readFileSync(path.join(rootDir, 'relay-state', 'identity.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.name || !parsed.privateKey) return null;
    // Not a format check — an actual parse by the thing that will use it.
    // Anything this accepts, sign() accepts.
    privateKeyFromB64(parsed.privateKey);
    return parsed;
  } catch (e) { /* none, or none usable */ }
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
  // Open is a real state and stays: it is what a relay looks like before
  // its first claim, which is the moment decision 0003 turns on. A names
  // branch stood beneath this and went with the mode (2026-09-15).
  if (allow.mode === 'open') return { ok: true };
  const pub = allow.byName[name];
  if (!pub) return { ok: false, status: 403, error: 'name not allowed' };
  if (!sig || !verify(pub, claimMessage(name), sig)) {
    return { ok: false, status: 403, error: 'bad claim signature' };
  }
  return { ok: true };
}

// checkSend, checkInboxKey AND checkInbox STOOD HERE — 66 lines, the
// three gates on the ring, deleted with it by R8 on 2026-09-15.
//
// The reasoning that produced them did not go with them, and two pieces
// of it are load-bearing elsewhere:
//
//   A DEVICE IS NOT A SECOND PARTY. It gets no peer row and claims no
//   label, so the second key lived on the owner RECORD and every gate
//   asking "is this the owner's signature" asked it of both strings.
//   allow.json in keys mode is the owner record, so a device key there
//   was a full copy of the owner's authority — the decision, not an
//   oversight. Reversed on 2026-09-12: checkOwner below takes the HOUSE
//   KEY ONLY, and a relay holds no device key at all now (deviceAuth.js).
//
//   A KEYLESS RELAY HAS NOTHING TO CHECK AGAINST. open and names mode
//   had no per-peer key, so both gates waved reads through. That is
//   why checkClaim above still branches on mode and these did not
//   survive: a read is gone, a claim is not.

// checkOwner STOOD HERE, and `statusMessage` above it. Both went with
// `GET /api/relay/status` on 2026-09-15 (R3,
// design/cycles/2026-09-15-labels-are-not-identities.md), which was the
// only thing either had ever gated.
//
// WHAT THE OWNER CHECK IS NOW, and it is not a replacement — it is where
// the question was already being answered better. `relay.isOwner(who)`
// compares the POST's proven sender against the key in allow.json, per
// verb, inside answerSelf. The post's own signature did the proving
// before that line ran, so there is no second place to decide who the
// owner is.
//
// WHAT WENT WITH IT, worth keeping because the reasoning outlived the
// function:
//
//   THE HOUSE KEY ONLY, and it REVERSED a decision. checkOwner used to
//   accept either key, on the reasoning that "being the owner from a
//   hotel room is the whole point of the device slot" — true of a design
//   in which a device had nowhere else to go.
//
//   Andy, 2026-09-12, shown what a device key actually reaches: "needs
//   fixing."
//
//   What it reached was ADMIN — through the console's isOwner, `status
//   peers search invites key version`, and `invites` lists LIVE TOKENS.
//   A seized phone could hand out access to the relay. Not "the owner
//   from a hotel room"; the owner's admin console in somebody else's
//   pocket.
//
// That rule is unchanged and now structural: a device signature does not
// verify against a row's key at all, so it is not narrowly refused — it
// never matches. A device is the owner's window, not the owner's
// credentials (design/relay/DEVICE.md).

function ownerName(allow) {
  if (allow.mode !== 'keys') return null;
  var names = Object.keys(allow.byName);
  return names.length ? names[0] : null;
}

module.exports = {
  RESERVED_NAME,
  claimMessage,
  streamMessage,
  streamSignatureOk,
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
  ownerName,
  loadPendingOwner,
  writePendingOwner,
  clearPendingOwner,
};
