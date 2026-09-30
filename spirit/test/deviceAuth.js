'use strict';

// spirit/test/deviceAuth.js
// THE NODE HOLDS THE DEVICE BINDING. THE RELAY HOLDS NOTHING.
//
// ── THIS FILE WAS NOT IN THE HARNESS ─────────────────────────────────
//
// It reported with a hand-rolled `ok()` over `assert`, and runAll
// discovers a suite by finding `startTest(` in it — so for as long as the
// runner has existed this file has been invisible to it. Nobody removed
// it; it was never there.
//
// What that cost: on 2026-09-13 the relay stopped keeping a copy of
// anyone's device key, and on 2026-09-15 `checkOwner` and `statusMessage`
// went with `GET /api/relay/status`. This file went on asserting all
// three, and threw on the first of them — so checks 14 through 20 have
// not run since, and nor has anything after them. Run by hand it was a
// stack trace; run by the harness it was nothing at all.
//
// It reports through testSupport now, which is the fix for that and the
// reason it is the first thing in this file.
//
// ── AND WHAT IT ASSERTS IS REVERSED ──────────────────────────────────
//
// The old checks said a relay fills `deviceByName`, that `keysForName`
// returns both keys, and that a device's signature passes `checkOwner`.
// Every one of those is now a thing that MUST NOT be true:
//
//   Andy, 2026-09-12, shown what a device key actually reached: "needs
//   fixing." It reached the admin console — status, peers, search, and
//   `invites`, which lists live tokens. A seized phone could hand out
//   access to the relay. Not "the owner from a hotel room"; the owner's
//   admin console in somebody else's pocket.
//
// So the assertions are inverted rather than deleted. A deleted check is
// a door left unlocked quietly — these say, in the place somebody would
// look, that the relay must not learn a device key and that there must be
// no second place to decide who the owner is.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const deviceAuth = require('../run/js/deviceAuth');
const relayAuth = require('../run/js/relayAuth');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-device-'));


test.startTest('The node holds the device binding, and the relay holds nothing');

// ── 1. THE PASSWORD, WHICH IS THE ONLY SECRET IN THIS ─────────────────

test.subHeading('The password lives in the node and is minted once');

const empty = deviceAuth.load(tmp);
if (empty.password === null && empty.devicePublicKey === null) {
  test.check('a node with no device has neither a password nor a slot');
} else {
  test.fail('an empty node already holds something: ' + JSON.stringify(empty));
}

const first = deviceAuth.ensurePassword(tmp);
if (first.password && first.password.length === deviceAuth.PASSWORD_HEX_LEN) {
  test.check('and minting gives ' + deviceAuth.PASSWORD_HEX_LEN + ' characters');
} else {
  test.fail('password length: ' + (first.password || '').length);
}

// HEX, and the length is why it can be: the transport is a clipboard and
// a password manager, never a person typing, so there is nothing to pay
// for the extra characters and no alphabet to argue about.
if (/^[0-9a-f]+$/.test(first.password)) {
  test.check('of hex, because it is copied and synced rather than typed');
} else {
  test.fail('not hex: ' + first.password.slice(0, 40));
}

// ENSURE IS NOT ROTATE. It is called on boot; a version that minted every
// time would invalidate the word already saved on somebody's phone once
// per restart, and look exactly like this one.
if (deviceAuth.ensurePassword(tmp).password === first.password) {
  test.check('and asking again returns the same one — ensure is not rotate');
} else {
  test.fail('ensurePassword minted a second password');
}

const house = relayAuth.generateIdentity('andy');
const phone = relayAuth.generateIdentity('device');
deviceAuth.setDevicePublicKey(tmp, phone.publicKey);

const stored = deviceAuth.load(tmp);
if (stored.devicePublicKey === phone.publicKey && stored.password === first.password) {
  test.check('the device key is stored beside the password, in the node');
} else {
  test.fail('slot: ' + JSON.stringify(stored));
}

// A NEAR MISS THAT IS ALWAYS A MISS. The check that stood here built one
// as `password.slice(0, -1) + '0'` — which is the SAME STRING one time in
// sixteen, when the password already ended in a zero. A test that passes
// fifteen runs out of sixteen is worse than none: the sixteenth reads as
// a real failure of the comparator and sends somebody into crypto code.
// This is the flake that was sitting behind the harness gap, and it fired
// on the first run after the file was put in front of the runner.
const lastChar = first.password.slice(-1);
const nearMiss = first.password.slice(0, -1) + (lastChar === '0' ? '1' : '0');

if (deviceAuth.passwordsEqual(first.password, first.password) &&
    !deviceAuth.passwordsEqual(first.password, nearMiss)) {
  test.check('and a password is compared here, in the one place that holds it');
} else {
  test.fail('passwordsEqual does not separate a match from a near miss');
}

// THE TWO EARLY RETURNS, which are the ones that would fail open: a
// length mismatch throws inside timingSafeEqual rather than returning
// false, and a non-string does the same. Both are caught, and a catch
// that returned true would let anything through.
if (!deviceAuth.passwordsEqual(first.password, first.password.slice(0, -1)) &&
    !deviceAuth.passwordsEqual(first.password, null) &&
    !deviceAuth.passwordsEqual(null, null)) {
  test.check('and a wrong length, a null and two nulls are all refused');
} else {
  test.fail('passwordsEqual answers true for something that is not the password');
}

// ── 2. THE RELAY LEARNS NO DEVICE KEY ────────────────────────────────

test.subHeading('And a relay reading its owner file learns only the owner key');

const pairRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-owner-pair-'));
fs.mkdirSync(path.join(pairRoot, 'relay-state'), { recursive: true });
fs.writeFileSync(path.join(pairRoot, 'relay-state', 'owner.json'),
  JSON.stringify({ owner: house.publicKey, devicePublicKey: phone.publicKey }));
const read = relayAuth.loadOwner(pairRoot);
if (read === house.publicKey) {
  test.check('owner.json yields the house key, and nothing of a device key written beside it');
} else {
  test.fail('loadOwner: ' + JSON.stringify(read));
}

// ── 3. AND THERE IS NO SECOND PLACE TO BE THE OWNER ──────────────────
//
// THIS INVERTS #1.16 THROUGH #1.19 — `keysForName` returning both keys,
// and a device signature passing `checkOwner`. All four functions are
// gone, and their absence is the security property rather than tidiness:
// a device signature does not verify against a row's key at all now, so
// it is not narrowly refused, it never matches.
//
// The owner question is answered in ONE place, `relay.isOwner(who)`,
// against the sender the POST's own signature already proved. A second
// answer is how the first one drifts.

test.subHeading('And the owner question has exactly one place to be answered');

const departed = [
  ['deviceAuth.keysForName', deviceAuth.keysForName],
  ['relayAuth.checkOwner', relayAuth.checkOwner],
  ['relayAuth.statusMessage', relayAuth.statusMessage],
].filter(function (pair) { return pair[1] !== undefined; });

if (!departed.length) {
  test.check('keysForName, checkOwner and statusMessage are gone, and stay gone');
} else {
  test.fail('back from the dead: ' + departed.map(function (p) { return p[0]; }).join(', '));
}

// AND THE TOMBSTONES SAY WHY. Each of these was removed for a reason a
// later session could undo in good faith — "being the owner from a hotel
// room is the whole point of the device slot" is a sentence somebody will
// write again. The note in the file is what stops it, so its absence is
// worth failing on.
const relaySrc = fs.readFileSync(
  path.join(__dirname, '..', 'run', 'js', 'relayAuth.js'), 'utf8');
if (/checkOwner STOOD HERE/.test(relaySrc) && /seized phone/i.test(relaySrc)) {
  test.check('and the note where they stood says what a device key reached');
} else {
  test.fail('the reasoning for removing checkOwner is no longer in relayAuth.js');
}

test.reportSuccessFailureCount();
