'use strict';

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
  const who = box.snapshot();
  const andys = (who.peers || []).filter(function (p) { return p.name === 'andy'; });
  const anyDeviceKey = (who.peers || []).some(function (p) { return p.devicePublicKey; });
  if (andys.length === 1 && !anyDeviceKey) {
    test.check('still one andy row, and no device key anywhere on the relay');
  } else {
    test.fail('peers: ' + JSON.stringify(who.peers));
  }

  // ── THE NEGATIVE, three ways ───────────────────────────────────────
  //
  // Each of these succeeded before 2026-09-13. They are the gates that
  // had no caller, and this is what stops them coming back as a "fix".

  const phoneSend = box.send(
    'andy', 'andy', 'from the phone',
    auth.sign(phone.privateKey, auth.sendMessage('andy', 'andy', 'from the phone'))
  );
  if (phoneSend && phoneSend.ok === false) {
    test.check('a device cannot send as its owner');
  } else {
    test.fail('device send: ' + JSON.stringify(phoneSend));
  }

  const phoneInbox = box.inbox(
    'andy', auth.sign(phone.privateKey, auth.inboxMessage('andy'))
  );
  if (phoneInbox && phoneInbox.ok === false) {
    test.check('and cannot read its owner\'s mail');
  } else {
    test.fail('device inbox: ' + JSON.stringify(phoneInbox));
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
  // Without these three, the checks above would pass on a relay that
  // simply refused everybody.

  const houseSend = box.send(
    'andy', 'andy', 'from the desk',
    auth.sign(house.privateKey, auth.sendMessage('andy', 'andy', 'from the desk'))
  );
  const houseInbox = box.inbox(
    'andy', auth.sign(house.privateKey, auth.inboxMessage('andy'))
  );
  if (houseSend.ok && houseInbox.ok) {
    test.check('while the house key still sends and reads, as it always did');
  } else {
    test.fail('house: send=' + houseSend.ok + ' inbox=' + houseInbox.ok);
  }

  // A stranger was always refused, and still is. This never depended on
  // device keys either way.
  const stranger = auth.generateIdentity('eve');
  const eveRead = box.inbox('andy', auth.sign(stranger.privateKey, auth.inboxMessage('andy')));
  const eveSend = box.send(
    'andy', 'andy', 'nope',
    auth.sign(stranger.privateKey, auth.sendMessage('andy', 'andy', 'nope'))
  );
  if (eveRead.ok === false && eveSend.ok === false) {
    test.check('and a stranger is refused both, as before');
  } else {
    test.fail('eve: read=' + eveRead.ok + ' send=' + eveSend.ok);
  }

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
