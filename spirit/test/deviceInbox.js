'use strict';
const rollOf = require('./rollOf');

// spirit/test/deviceInbox.js
// A DEVICE KEY PROVES NOTHING TO A RELAY.
//
// ── WHAT THIS SUITE USED TO SAY ──────────────────────────────────────
//
// Its header read: "Cycle 2. Device key may send, read, and sit on the
// owner record." All three were true, all three are gone, and the reason
// is one sentence of Andy's:
//
//   "the device key is used to mirror/fake the protocol for the one leg
//   of the route where it's not actually compliant... and to safely tie
//   a device to its node."
//
// Neither job is the relay's. The binding lives in the node's own
// relay-state/device.json; the relay is a conduit that carries an
// enrolment offer to the owning node and learns whether it was accepted.
// The relay's copy of a device key was read in exactly two places — inside
// `send` and inside `inbox` — and NOTHING in the tree ever exercised
// either. device.html's own `sendMessage` helper had one occurrence: its
// own definition.
//
// A relay holding a credential it never reads is storing something on
// somebody's behalf, which is what decision 0006 emptied it for.
//
// ── WHAT IS WORTH ASSERTING NOW ──────────────────────────────────────
//
// The negative, because it is load-bearing and because a future session
// looking at deviceOffer could easily re-add the gates by "fixing" what
// looks like an omission. And the two positives that never depended on
// device keys: a stranger is still refused, and enrolling never grows a
// second row.

const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const deviceAuth = require('../run/js/deviceAuth');
const deviceTick = require('../run/js/deviceTick');
const world = require('./world');

const SCENARIO = require('./scenario').OWNER_ONLY;

test.startTest('A device key proves nothing to a relay');

(async function run() {
  const L = world.build(SCENARIO);
  if (!L.ok) { test.fail(L.error); test.reportSuccessFailureCount(); return; }
  const box = L.box;
  const house = L.owner;
  const home = L.ownerHome();
  const phone = auth.generateIdentity('device');

  test.check('house is owner');

  // ENROLLED PROPERLY, through the node that owns the device — which is
  // the only place an enrolment is decided.
  deviceAuth.ensurePassword(home);
  const decided = await deviceTick.answerOffer(home, {
    password: deviceAuth.load(home).password,
    devicePublicKey: phone.publicKey,
  });
  if (decided && decided.accepted &&
      deviceAuth.load(home).devicePublicKey === phone.publicKey) {
    test.check('the node bound the device, in its own file');
  } else {
    test.fail('binding: ' + JSON.stringify(decided));
  }

  // AND THE RELAY LEARNED NOTHING. Not a row, not a slot, not a key.
  // Read off the relay's disc (relay.db since cycle 3): the report
  // carries a COUNT of members now, never the rows.
  const who = { peers: rollOf(box) };
  // `p.name` until 2026-09-15, when a roll row stopped saying a peer's
  // label twice. One field, and it is the one that says what it is.
  const andys = (who.peers || []).filter(function (p) { return p.publicLabel === 'andy'; });
  const anyDeviceKey = (who.peers || []).some(function (p) { return p.devicePublicKey; });
  if (andys.length === 1 && !anyDeviceKey) {
    test.check('still one andy row, and no device key anywhere on the relay');
  } else {
    test.fail('peers: ' + JSON.stringify(who.peers));
  }

  // ── THE NEGATIVE, two ways ─────────────────────────────────────────
  //
  // Each of these succeeded before 2026-09-13. They are the gates that
  // had no caller, and this is what stops them coming back as a "fix".
  //
  // It was THREE ways until R8 (2026-09-15): `send` and `inbox` each had
  // a device branch, and both are gone with the transport that held them.
  // What is asked instead is the same question of the transport that is
  // left — a device key must not POST as its owner — plus the stream
  // check, which never depended on the ring at all.

  const TEXT = '{"app":"device-probe","v":1,"body":"from the phone"}';

  const phonePost = box.routePost(
    house.publicKey, house.publicKey, TEXT,
    auth.sign(phone.privateKey, auth.postMessage(house.publicKey, house.publicKey, TEXT))
  );
  if (phonePost && phonePost.ok === false && phonePost.status === 403) {
    test.check('a device cannot post as its owner');
  } else {
    test.fail('device post: ' + JSON.stringify(phonePost));
  }

  const phoneStream = box.streamOpen(
    'andy', auth.sign(phone.privateKey, auth.streamMessage(house.publicKey)),
    { write: function () { return true; }, close: function () {} }
  );
  if (phoneStream && phoneStream.ok === false) {
    test.check('and cannot open the wire its owner is on — which was always true');
  } else {
    test.fail('device stream: ' + JSON.stringify(phoneStream));
  }

  // ── AND THE HOUSE KEY IS UNTOUCHED ─────────────────────────────────
  //
  // Without this, the checks above would pass on a relay that simply
  // refused everybody.

  const houseSink = { lines: [], write: function (c) { this.lines.push(c); }, close: function () {} };
  const houseStream = box.streamOpen(
    house.publicKey,
    auth.sign(house.privateKey, auth.streamMessage(house.publicKey)),
    houseSink
  );
  const housePost = box.routePost(
    house.publicKey, house.publicKey, TEXT,
    auth.sign(house.privateKey, auth.postMessage(house.publicKey, house.publicKey, TEXT))
  );
  if (houseStream.ok && housePost.ok) {
    test.check('while the house key still opens the wire and posts, as it always did');
  } else {
    test.fail('house: stream=' + houseStream.ok + ' post=' + housePost.ok +
      ' ' + JSON.stringify(housePost));
  }

  // A stranger was always refused, and still is. This never depended on
  // device keys either way.
  const stranger = auth.generateIdentity('eve');
  const evePost = box.routePost(
    house.publicKey, house.publicKey, TEXT,
    auth.sign(stranger.privateKey, auth.postMessage(house.publicKey, house.publicKey, TEXT))
  );
  const eveStream = box.streamOpen(
    house.publicKey, auth.sign(stranger.privateKey, auth.streamMessage(house.publicKey)),
    { write: function () { return true; }, close: function () {} }
  );
  if (evePost.ok === false && eveStream.ok === false) {
    test.check('and a stranger is refused both, as before');
  } else {
    test.fail('eve: post=' + evePost.ok + ' stream=' + eveStream.ok);
  }
  box.streamClose(house.publicKey);

  // AND A DEVICE MUST NOT BECOME A ROW. The one rule from this suite's
  // original subject that still has something to guard: a device that
  // claimed the label would be a second row wearing `andy`, which is what
  // makes resolveParty ambiguous and stops the owner's own mail resolving.
  const claimDevice = box.claim(
    'andy', auth.sign(phone.privateKey, auth.claimMessage('andy')), phone.publicKey
  );
  if (claimDevice && claimDevice.ok === false) {
    test.check('a device must not claim the label — no second row wearing andy');
  } else {
    test.fail('second claim: ' + JSON.stringify(claimDevice));
  }

  test.reportSuccessFailureCount();
}());
