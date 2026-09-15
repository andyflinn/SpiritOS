'use strict';

// spirit/test/deviceDisplace.js
// Cycle 5. A second enrolment replaces the slot. The old device is out.
//
// ── THE RULE, AND WHY IT IS A RULE ───────────────────────────────────
//
//   Andy: "There is a security reasoning behind 'Only one device per
//   peer'. A human can only use one device at the time (usually) and
//   there should be no other devices scattered about that other humans
//   can use to access the personal server."
//
//   Andy: "a user may have multiple devices logged into his chrome
//   account, they can actually live side by side, BUT, the red-button
//   concept disconnects them ALL. that is where the security advantage of
//   'just one per peer' comes into play."
//
// So the slot is not a simplification waiting to be relaxed into a list.
// One slot makes "disconnect everything" a SINGLE IDEMPOTENT WRITE — it
// cannot half-succeed, and it can be safely repeated. A list would make
// the same button an enumeration that can fail partway and leave nobody
// knowing which doors are still open.
//
// ── WHERE THE SLOT MOVED ─────────────────────────────────────────────
//
// This file used to test the slot on the RELAY — allow.json's
// deviceByName, and which device could read the relay's inbox before and
// after. A relay holds no device key now: the binding between a device
// and its node is the node's, and the relay is a conduit that carries an
// enrolment offer and learns whether it was accepted (deviceAuth.js).
//
// The subject is unchanged and the evidence moved with it. Replacement is
// asserted on the node's own file, and the relay is asked to prove it
// holds nothing — before or after.

const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const deviceAuth = require('../run/js/deviceAuth');
const deviceTick = require('../run/js/deviceTick');
const world = require('./world');

const SCENARIO = require('./scenario').OWNER_ONLY;

test.startTest('Device cycle 5 — replace the slot, and the replacement is confined too');

(async function run() {
  const L = world.build(SCENARIO);
  if (!L.ok) { test.fail(L.error); test.reportSuccessFailureCount(); return; }
  const box = L.box;
  const house = L.owner;
  const home = L.ownerHome();

  // Two device keys. Neither is a peer and neither joins the relay: they
  // are candidates for the one slot the NODE holds, which is the whole
  // subject of this file.
  const phone = auth.generateIdentity('phone');
  const tablet = auth.generateIdentity('tablet');

  test.check('house owns the mailbox');

  deviceAuth.ensurePassword(home);
  const password = deviceAuth.load(home).password;

  const first = await deviceTick.answerOffer(home, {
    password: password, devicePublicKey: phone.publicKey,
  });
  if (first.accepted && deviceAuth.load(home).devicePublicKey === phone.publicKey) {
    test.check('phone enrolled, and the node wrote it down');
  } else {
    test.fail('first slot: ' + JSON.stringify(first));
  }

  const second = await deviceTick.answerOffer(home, {
    password: password, devicePublicKey: tablet.publicKey,
  });
  if (second.accepted && deviceAuth.load(home).devicePublicKey === tablet.publicKey) {
    test.check('tablet replaced the slot');
  } else {
    test.fail('second slot: ' + JSON.stringify(second));
  }

  // THE HALF THAT MATTERS: the old one is OUT, not merely second.
  if (deviceAuth.load(home).devicePublicKey !== phone.publicKey) {
    test.check('and the phone is gone — replaced, never appended');
  } else {
    test.fail('the phone survived: ' + JSON.stringify(deviceAuth.load(home)));
  }

  // ONE SLOT IS A SHAPE, NOT A COUNT. There is no list to grow, which is
  // what makes a future widening deliberate rather than accidental — and
  // what makes the red button one write.
  const doc = deviceAuth.load(home);
  if (typeof doc.devicePublicKey === 'string' && !Array.isArray(doc.devicePublicKey)) {
    test.check('the slot is one string — there is nothing to append to');
  } else {
    test.fail('slot shape: ' + JSON.stringify(doc.devicePublicKey));
  }

  // ── AND THE RELAY HOLDS NOTHING, BEFORE OR AFTER ────────────────────
  //
  // Two enrolments happened and no relay was told about either. That is
  // the thing that deletes the hazard the old arrangement had: a device
  // key stranded on a relay that was unreachable when it was replaced.
  const allow = auth.loadAllow(L.home);
  if (!allow.deviceByName) {
    test.check('the relay keeps no device slot at all — nothing to strand');
  } else {
    test.fail('deviceByName survives: ' + JSON.stringify(allow.deviceByName));
  }

  // PROVED BY USE, not by reading a field: neither key opens anything on
  // the relay, and the house key still does — so this is not a check that
  // passes because the box refuses everybody.
  //
  // Asked of the STREAM since R8 deleted `inbox` (2026-09-15). It is the
  // sharper question of the two anyway: opening the wire buys a standing
  // grant, where a read bought one answer.
  function opens(id) {
    const r = box.streamOpen(
      house.publicKey,
      auth.sign(id.privateKey, auth.streamMessage(house.publicKey)),
      { write: function () { return true; }, close: function () {} }
    );
    if (r.ok) box.streamClose(house.publicKey);
    return r.ok;
  }
  const phoneOpens = opens(phone);
  const tabletOpens = opens(tablet);
  const houseOpens = opens(house);

  if (!phoneOpens && !tabletOpens && houseOpens) {
    test.check('neither the old device nor the new one opens the relay, while the house key still does');
  } else {
    test.fail('streams: phone=' + phoneOpens + ' tablet=' + tabletOpens +
      ' house=' + houseOpens);
  }

  // AND THE CURRENT DEVICE REACHES NOTHING ON THE WIRE EITHER. The last
  // exception — the reserved name `relay` — went with the console on
  // 2026-09-13, and the identity it belongs to went with the relay's copy
  // of the key. A device's correspondent is the node that owns it.
  //
  // `send` was the verb here until R8. `post` is the verb now, and the
  // answer is the same for the same reason: the tablet's signature does
  // not verify against the row's key, and the row's key is the only one
  // this box will check.
  const TEXT = '{"app":"device-probe","v":1,"body":"note to self"}';
  const atSelf = box.routePost(
    house.publicKey, house.publicKey, TEXT,
    auth.sign(tablet.privateKey, auth.postMessage(house.publicKey, house.publicKey, TEXT))
  );
  const atRelay = box.routePost(
    house.publicKey, box.mailboxPublicKey(), TEXT,
    auth.sign(tablet.privateKey, auth.postMessage(house.publicKey, box.mailboxPublicKey(), TEXT))
  );

  if (!atRelay.ok && !atSelf.ok) {
    test.check('and the enrolled tablet reaches nothing on the relay — not the relay itself, not its own row');
  } else {
    test.fail('tablet reached: relay=' + atRelay.ok + ' self=' + atSelf.ok);
  }

  test.reportSuccessFailureCount();
}());
