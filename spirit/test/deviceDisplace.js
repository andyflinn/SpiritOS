'use strict';

// spirit/test/deviceDisplace.js
// Cycle 5. Second handshake replaces the slot. Old device is out.

const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const deviceAuth = require('../run/js/deviceAuth');
const world = require('./world');

const SCENARIO = require('./scenario').OWNER_ONLY;

test.startTest('Device cycle 5 — replace the slot, console send as device');

{
  const L = world.build(SCENARIO);
  const home = L.home;
  const box = L.box;
  const house = L.owner;

  // Two device keys, made here rather than in the scenario: neither is a
  // peer and neither joins the relay. They are candidates for the one
  // slot the owner's row holds, which is the whole subject of this file.
  const phone = auth.generateIdentity('phone');
  const tablet = auth.generateIdentity('tablet');

  if (L.ok) test.check('house owns the mailbox');
  else test.fail(L.error);

  const first = box.setDevice(
    'andy',
    phone.publicKey,
    auth.sign(house.privateKey, deviceAuth.setDeviceMessage(phone.publicKey))
  );
  if (!first.ok) test.fail('first slot: ' + JSON.stringify(first));
  else test.check('phone installed');

  const phoneRead = box.inbox(
    'andy',
    auth.sign(phone.privateKey, auth.inboxMessage('andy'))
  );
  if (phoneRead.ok) test.check('phone can read');
  else test.fail('phone read: ' + JSON.stringify(phoneRead));

  const second = box.setDevice(
    'andy',
    tablet.publicKey,
    auth.sign(house.privateKey, deviceAuth.setDeviceMessage(tablet.publicKey))
  );
  if (!second.ok) test.fail('second slot: ' + JSON.stringify(second));
  else test.check('tablet replaced the slot');

  const allow = auth.loadAllow(home);
  if (allow.deviceByName.andy === tablet.publicKey) test.check('allow holds the tablet');
  else test.fail('deviceByName: ' + JSON.stringify(allow.deviceByName));
  if (allow.deviceByName.andy !== phone.publicKey) test.check('phone key is gone from allow');
  else test.fail('phone still listed');

  const phoneAfter = box.inbox(
    'andy',
    auth.sign(phone.privateKey, auth.inboxMessage('andy'))
  );
  if (phoneAfter && phoneAfter.ok === false) test.check('old phone cannot read');
  else test.fail('phone after: ' + JSON.stringify(phoneAfter));

  const tabletRead = box.inbox(
    'andy',
    auth.sign(tablet.privateKey, auth.inboxMessage('andy'))
  );
  if (tabletRead.ok) test.check('tablet can read');
  else test.fail('tablet read: ' + JSON.stringify(tabletRead));

  const houseRead = box.inbox(
    'andy',
    auth.sign(house.privateKey, auth.inboxMessage('andy'))
  );
  if (houseRead.ok) test.check('house can still read');
  else test.fail('house read: ' + JSON.stringify(houseRead));

  const consoleSend = box.send(
    'andy',
    'relay',
    'help',
    auth.sign(tablet.privateKey, auth.sendMessage('andy', 'relay', 'help'))
  );
  if (consoleSend.ok && consoleSend.consoleReply && consoleSend.consoleReply.text) {
    test.check('tablet console returns in the send');
  } else {
    test.fail('console: ' + JSON.stringify(consoleSend));
  }

  if (typeof test.reportSuccessFailureCount === 'function') {
    test.reportSuccessFailureCount();
  }
}
