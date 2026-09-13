'use strict';

// spirit/run/js/deviceAuth.js
// device.json is PERSONAL NODE ONLY — the password lives there and
// nowhere else. It is never written on a --relay and never put in
// routingTable.json.
//
// The MODULE is loaded on a relay too, for the two pure functions a row
// needs: keysForName (is this key the owner's?) and the message bytes a
// signature is made over. Those carry no secret. The distinction matters
// because "personal node only" read as a claim about the module would
// make the relay's own require() look like a mistake.
//
// So this module:
//   - mints / stores the door password            (personal node)
//   - remembers the current device public key     (personal node)
//   - names the bytes the house key must sign     (both)
//   - answers which keys are one name's           (both)
//
// Key encoding matches relayAuth.generateIdentity (SPKI / PKCS8 base64).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PASSWORD_HEX_LEN = 128;

// A KEY IN A URL SEGMENT. Keys are stored as standard base64 — the
// alphabet includes `+`, `/` and `=`, and a `/` in a path segment is not
// in the segment at all, it splits it. So the URL carries base64url:
// the same bytes, `-` and `_` for `+` and `/`, padding dropped.
//
// Lossless and canonical — one key produces exactly one segment and back
// again — which matters because the segment IS the identity the relay
// looks up. Hex would also work and is what PEER-DEVICES.md first said;
// base64url is 58 characters against 88 for the same bytes, and nobody
// types either.
//
// It is a LOCATOR, not a credential. Every key here is already public at
// /api/relay/who — putting one in a URL gives away nothing, and grants
// nothing either.
function keyToUrl(publicKey) {
  return String(publicKey == null ? '' : publicKey)
    .trim()
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Back to the stored form. Padding is restored because base64 decoders
// on the other side of this are stricter than they look.
function keyFromUrl(segment) {
  var s = String(segment == null ? '' : segment).trim();
  if (!s || !/^[A-Za-z0-9_-]+$/.test(s)) return '';
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  return s;
}

function devicePath(rootDir) {
  return path.join(rootDir, 'relay-state', 'device.json');
}

// THERE IS NO WINDOW ANY MORE (Andy: "no backstop, no listening mode on
// the personal node. the ability to setup one-device-for-all-peers just
// IS").
//
// `listening` was a second gate behind the password, and it existed for
// a cost that no longer exists. While enrolment depended on a poll, an
// open window meant a timer on every node forever — "a timer whose every
// pass is a no-op is noise on every fake peer in the lab". Nothing polls
// now: an offer arrives on a stream the node is already holding, and an
// idle node costs nothing at all.
//
// What the gate bought was thin, and worth stating rather than mourned.
// It never protected the password; it only meant an attacker holding one
// had to catch a window somebody had opened — and somebody who holds the
// password can simply wait for the next one. What remains is the
// password itself, and the fact that there is ONE slot: a new enrolment
// displaces the old device, so an intrusion is visible rather than
// silent.
//
// A file written by older code still has the field. It is read as
// nothing and dropped on the next write.
function emptyDoc() {
  return { password: null, devicePublicKey: null };
}

function load(rootDir) {
  try {
    var parsed = JSON.parse(fs.readFileSync(devicePath(rootDir), 'utf8'));
    if (!parsed || typeof parsed !== 'object') return emptyDoc();
    return {
      password: typeof parsed.password === 'string' ? parsed.password : null,
      devicePublicKey: typeof parsed.devicePublicKey === 'string'
        ? parsed.devicePublicKey
        : null,
    };
  } catch (e) {
    return emptyDoc();
  }
}

function save(rootDir, doc) {
  fs.mkdirSync(path.join(rootDir, 'relay-state'), { recursive: true });
  var file = devicePath(rootDir);
  var tmp = file + '.tmp';
  var body = {
    password: doc && doc.password ? doc.password : null,
    devicePublicKey: doc && doc.devicePublicKey ? doc.devicePublicKey : null,
  };
  fs.writeFileSync(tmp, JSON.stringify(body, null, 2));
  fs.renameSync(tmp, file);
}

function generatePassword() {
  return crypto.randomBytes(PASSWORD_HEX_LEN / 2).toString('hex');
}

function ensurePassword(rootDir) {
  var doc = load(rootDir);
  if (doc.password && doc.password.length === PASSWORD_HEX_LEN) return doc;
  doc.password = generatePassword();
  save(rootDir, doc);
  return load(rootDir);
}

// A NEW PASSWORD, AND THE OLD ONE DEAD.
//
// Grok, reviewing DEVICE.md: a relay is handed the enrolment password in
// cleartext, so a crooked relay that carries ONE legitimate enrolment
// keeps it and can enrol a device of its own afterwards, at leisure. That
// is a standing capability, not an attempt — and rotation is the only
// answer available, because sealing the channel would need a primitive
// the bootstrap cannot provide (the relay is inside it).
//
// Andy: "the red-button rotate password can easily deny all requests from
// the old password, that's kind of the point."
//
// TOTAL WITHIN ITS SCOPE, and worth saying without hedging. The password
// is compared in exactly one place — deviceTick.answerOffer — so after
// this every request that depends on the old one is denied, which is the
// whole of what the password ever did. Whoever captured it holds a dead
// string.
//
// WHAT IT IS NOT is a different verb, not a shortfall: it does not
// detach a device already attached. That is revocation. Saying rotation
// does not revoke is like saying new locks do not evict a tenant — true,
// and not a criticism of locks. The red button performs both; this is one
// of the two.
//
// The device key is left exactly as it is, deliberately. A caller that
// wants both says so by calling both, and a caller that wanted only a
// fresh password has not silently lost its phone.
function rotatePassword(rootDir) {
  var doc = load(rootDir);
  doc.password = generatePassword();
  save(rootDir, doc);
  return load(rootDir);
}

function setDevicePublicKey(rootDir, publicKey) {
  var doc = ensurePassword(rootDir);
  doc.devicePublicKey = publicKey ? String(publicKey) : null;
  save(rootDir, doc);
  return load(rootDir);
}

function passwordsEqual(stored, given) {
  if (typeof stored !== 'string' || typeof given !== 'string') return false;
  if (stored.length !== given.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(given));
  } catch (e) {
    return false;
  }
}

// setDeviceMessage STOOD HERE — its own format so that a `status`
// signature, which an owner makes constantly, could never be replayed as
// "install this key".
//
// A post keeps that property and adds the one this could not have: it
// binds the RECIPIENT, so a signature made for one relay cannot install a
// key on another. setDeviceMessage carried only the device key, which is
// why deviceTick had to re-sign per relay and why straddling a minute
// boundary was a real failure mode — "a failure that appears only
// sometimes, only on slow links, and only for the mailbox listed last".
//
// Enrolment is a packet now (relay.answerSelf, body.setDevice), and there
// is nothing left to hand-roll. Decision 0010.

// THERE IS NO `device-take` MESSAGE ANY MORE. It signed two verbs that no
// longer exist — "hand me the pending device request" and "here is my
// answer to it" — both of which were reads and writes against a RAM slot
// on the relay, reached by a poll.
//
// Nothing is parked to be fetched now, so nothing has to be authorised to
// fetch it: the offer is posted to the node on the stream it is already
// holding, and the node's answer comes back on the same round trip. The
// authority that used to live in this signature lives in that stream —
// only the node holding it receives the offer at all.
//
// The minute-scoped shape it used survives where it is still needed, in
// relayAuth.inboxMessage / inboxSignatureOk, and inboxSig.js is where it
// is proven.

// allow.byName stays the owner string. Extra device key is sibling field.
// keysForName STOOD HERE — the relay's copy of a device key, and the two
// gates that honoured it.
//
// ── WHY IT IS GONE ───────────────────────────────────────────────────
//
//   Andy: "the device key is used to mirror/fake the protocol for the one
//   leg of the route where it's not actually compliant... and to safely
//   tie a device to its node."
//
// Two jobs, and NEITHER of them is the relay's:
//
//   1. A STAND-IN ON THE LEG THAT IS NOT PROTOCOL. A browser on a phone
//      has no row, no stream and cannot post. deviceOffer is the shape
//      that leg takes: the relay turns the browser's request into an
//      ORDINARY POST to the owning node, and the node answers on its own
//      stream. The relay is a CONDUIT. device.html states the rule — "a
//      device's correspondent is the node that owns it".
//
//   2. THE BINDING, safely. The browser makes the keypair and keeps the
//      private half; the password proves the human and is compared in
//      exactly ONE place, the owning node (deviceTick.answerOffer). The
//      relay carries the question and never learns the answer.
//
// So the binding lives in the node's relay-state/device.json, and always
// did. The copy each relay kept was read in exactly two places — inside
// `send` and inside `inbox` — and NOTHING EVER EXERCISED EITHER. No app,
// no shell, no device page: device.html's own `sendMessage` helper had a
// single occurrence in the tree, its own definition.
//
// A relay holding a credential it never reads is storing something on
// somebody's behalf, which is what decision 0006 emptied it for.
//
// ── WHAT WENT WITH IT ────────────────────────────────────────────────
//
// Three hazards, deleted rather than fixed:
//
//   a device left working on a relay that was unreachable when a new one
//     was enrolled — there is no copy to leave behind now
//   a revocation that had to reach every relay — the red button is one
//     node-local write
//   a device key that was "a full copy of the owner's authority on this
//     box", which is what the note here used to have to justify
//
function parseKeyRow(row) {
  if (!row || typeof row !== 'object') return null;
  if (typeof row.name !== 'string' || !row.name.trim()) return null;
  var owner = row.publicKey || row.owner;
  if (typeof owner !== 'string' || !owner) return null;
  var device = row.devicePublicKey || row.device || null;
  if (typeof device !== 'string' || !device) device = null;
  return { name: row.name.trim(), publicKey: owner, devicePublicKey: device };
}

module.exports = {
  keyToUrl: keyToUrl,
  keyFromUrl: keyFromUrl,
  PASSWORD_HEX_LEN: PASSWORD_HEX_LEN,
  devicePath: devicePath,
  load: load,
  save: save,
  generatePassword: generatePassword,
  ensurePassword: ensurePassword,
  rotatePassword: rotatePassword,
  setDevicePublicKey: setDevicePublicKey,
  passwordsEqual: passwordsEqual,
  parseKeyRow: parseKeyRow
};
