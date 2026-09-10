'use strict';

// spirit/test/deviceListen.js
// Cycle 3. Listening flag + one tick installs the slot. No browser.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const deviceAuth = require('../run/js/deviceAuth');
const deviceTick = require('../run/js/deviceTick');
const { createRelay } = require('../run/js/relay');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-device-listen-'));
}

test.startTest('Device cycle 3 — listen and tick');

async function run() {
  const home = tmpHome();
  const box = createRelay(home);
  const house = auth.generateIdentity('andy');
  auth.saveIdentity(home, house);
  const phone = auth.generateIdentity('device');

  const claimed = box.claim(
    'andy',
    auth.sign(house.privateKey, auth.claimMessage('andy')),
    house.publicKey
  );
  if (!claimed.ok) test.fail('claim: ' + JSON.stringify(claimed));
  else test.check('house owns the lab mailbox');

  const quiet = await deviceTick.tick(home, ['http://relay'], function () {
    return Promise.resolve({});
  });
  if (quiet && quiet.did === 'quiet') test.check('tick is inert when not listening');
  else test.fail('quiet: ' + JSON.stringify(quiet));

  deviceAuth.ensurePassword(home);
  deviceAuth.setListening(home, true);
  const doc = deviceAuth.load(home);
  if (doc.listening && doc.password) test.check('listening stored');
  else test.fail('doc: ' + JSON.stringify(doc));

  const offerP = box.deviceOffer(doc.password, phone.publicKey);

  async function requestFn(url, method, pth, body) {
    if (method === 'GET' && /device-pending/.test(pth)) {
      const held = box.deviceTake();
      return held || {};
    }
    if (method === 'POST' && /set-device/.test(pth)) {
      return box.setDevice(body.name, body.devicePublicKey, body.sig);
    }
    if (method === 'POST' && /device-answer/.test(pth)) {
      return box.deviceReply(!!body.accepted);
    }
    return { ok: false };
  }

  const did = await deviceTick.tick(home, ['http://relay'], requestFn);
  if (did && did.did === 'installed') test.check('tick installed the device');
  else test.fail('tick: ' + JSON.stringify(did));

  const browser = await offerP;
  if (browser && browser.ok) test.check('held POST completed');
  else test.fail('browser: ' + JSON.stringify(browser));

  const phoneInbox = box.inbox(
    'andy',
    auth.sign(phone.privateKey, auth.inboxMessage('andy'))
  );
  if (phoneInbox.ok) test.check('device can read after tick');
  else test.fail('inbox: ' + JSON.stringify(phoneInbox));

  deviceAuth.setListening(home, false);
  const after = await deviceTick.tick(home, ['http://relay'], requestFn);
  if (after && after.did === 'quiet') test.check('close window stops the tick');
  else test.fail('after: ' + JSON.stringify(after));

  const wrongHome = tmpHome();
  const wrongBox = createRelay(wrongHome);
  wrongBox.claim(
    'andy',
    auth.sign(house.privateKey, auth.claimMessage('andy')),
    house.publicKey
  );
  auth.saveIdentity(wrongHome, house);
  deviceAuth.ensurePassword(wrongHome);
  deviceAuth.setListening(wrongHome, true);
  const live = deviceAuth.load(wrongHome).password;
  const offerWrong = wrongBox.deviceOffer(live.split('').reverse().join(''), phone.publicKey);

  async function rejectFn(url, method, pth, body) {
    if (method === 'GET' && /device-pending/.test(pth)) {
      return wrongBox.deviceTake() || {};
    }
    if (method === 'POST' && /set-device/.test(pth)) {
      test.fail('setDevice must not run on a wrong password');
      return { ok: false };
    }
    if (method === 'POST' && /device-answer/.test(pth)) {
      return wrongBox.deviceReply(!!body.accepted);
    }
    return { ok: false };
  }

  const rejected = await deviceTick.tick(wrongHome, ['http://relay'], rejectFn);
  if (rejected && rejected.did === 'rejected') test.check('wrong password is rejected');
  else test.fail('rejected: ' + JSON.stringify(rejected));

  const browserNo = await offerWrong;
  if (browserNo && browserNo.ok === false && browserNo.error === 'not now') {
    test.check('browser also sees not now');
  } else {
    test.fail('browserNo: ' + JSON.stringify(browserNo));
  }

  if (typeof test.reportSuccessFailureCount === 'function') {
    test.reportSuccessFailureCount();
  }
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  if (typeof test.reportSuccessFailureCount === 'function') {
    test.reportSuccessFailureCount();
  }
});
