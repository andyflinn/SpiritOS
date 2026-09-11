'use strict';

// spirit/test/deviceInbox.js
// Cycle 2. Device key may send, read, and sit on the owner record.
// No second peer row. fromKey on the wire stays the house key.

const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const deviceAuth = require('../run/js/deviceAuth');
const world = require('./world');

const SCENARIO = require('./scenario').OWNER_ONLY;

test.startTest('Device cycle 2 — inbox and send as the owner device');

{
  const L = world.build(SCENARIO);
  const box = L.box;
  const house = L.owner;
  const phone = auth.generateIdentity('device');
  if (L.ok) test.check('house is owner');
  else test.fail(L.error);

  const set = box.setDevice(
    'andy',
    phone.publicKey,
    auth.sign(house.privateKey, deviceAuth.setDeviceMessage(phone.publicKey))
  );
  if (!set || !set.ok) test.fail('setDevice: ' + JSON.stringify(set));
  else test.check('house installed the device key');

  // snapshot(), not who(): who() IS the peer array, so reading .peers off
  // it asked an array for a field and quietly found nobody — the check
  // failed while the thing it guards (one row, never two) was correct.
  const who = box.snapshot();
  const andys = (who.peers || []).filter(function (p) { return p.name === 'andy'; });
  if (andys.length === 1) test.check('still one andy row');
  else test.fail('peers: ' + JSON.stringify(who.peers));

  const statusSig = auth.sign(house.privateKey, auth.statusMessage('andy'));
  const replay = box.setDevice('andy', phone.publicKey, statusSig);
  if (replay && replay.ok === false) test.check('status signature is not set-device');
  else test.fail('replay: ' + JSON.stringify(replay));

  const houseSend = box.send(
    'andy',
    'andy',
    'from the desk',
    auth.sign(house.privateKey, auth.sendMessage('andy', 'andy', 'from the desk'))
  );
  if (!houseSend.ok) test.fail('house send: ' + JSON.stringify(houseSend));
  else test.check('house can still send');

  const phoneSend = box.send(
    'andy',
    'andy',
    'from the phone',
    auth.sign(phone.privateKey, auth.sendMessage('andy', 'andy', 'from the phone'))
  );
  if (!phoneSend.ok) test.fail('device send: ' + JSON.stringify(phoneSend));
  else test.check('device can send as andy');

  if (phoneSend.fromKey === house.publicKey) test.check('fromKey is the house');
  else test.fail('fromKey: ' + String(phoneSend.fromKey));

  const phoneInbox = box.inbox(
    'andy',
    auth.sign(phone.privateKey, auth.inboxMessage('andy'))
  );
  if (phoneInbox.ok && (phoneInbox.messages || []).length >= 2) {
    test.check('device can read andy');
  } else {
    test.fail('device inbox: ' + JSON.stringify(phoneInbox));
  }

  const houseInbox = box.inbox(
    'andy',
    auth.sign(house.privateKey, auth.inboxMessage('andy'))
  );
  if (houseInbox.ok) test.check('house can still read');
  else test.fail('house inbox: ' + JSON.stringify(houseInbox));

  const stranger = auth.generateIdentity('eve');
  const eveRead = box.inbox(
    'andy',
    auth.sign(stranger.privateKey, auth.inboxMessage('andy'))
  );
  if (eveRead && eveRead.ok === false) test.check('stranger still 403');
  else test.fail('eve: ' + JSON.stringify(eveRead));

  const eveSend = box.send(
    'andy',
    'andy',
    'nope',
    auth.sign(stranger.privateKey, auth.sendMessage('andy', 'andy', 'nope'))
  );
  if (eveSend && eveSend.ok === false) test.check('stranger cannot send as andy');
  else test.fail('eve send: ' + JSON.stringify(eveSend));

  const claimDevice = box.claim(
    'andy',
    auth.sign(phone.privateKey, auth.claimMessage('andy')),
    phone.publicKey
  );
  if (claimDevice && claimDevice.ok === false) test.check('device must not claim the label');
  else test.fail('second claim: ' + JSON.stringify(claimDevice));
}

test.reportSuccessFailureCount();
