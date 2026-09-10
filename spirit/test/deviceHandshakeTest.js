'use strict';

// spirit/test/deviceHandshake.js
// Cycle 2. RAM slot only. Password never written.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const deviceAuth = require('../run/js/deviceAuth');
const { createQueue } = require('../run/js/deviceHandshake');
const { createRelay } = require('../run/js/relay');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-device-hs-'));
}

test.startTest('Device cycle 2 — RAM handshake');

async function run() {
  const q = createQueue({ waitMs: 80 });

  const first = q.offer('secret', 'pk-a');
  const peek = q.take();
  if (peek && peek.password === 'secret' && peek.devicePublicKey === 'pk-a') {
    test.check('take sees the live slot');
  } else {
    test.fail('take: ' + JSON.stringify(peek));
  }

  const busy = await q.offer('other', 'pk-b');
  if (busy && busy.ok === false && busy.error === 'not now') {
    test.check('second offer refused while slot live');
  } else {
    test.fail('busy: ' + JSON.stringify(busy));
  }

  const answered = q.reply(true);
  const got = await first;
  if (answered.ok && got.ok && got.devicePublicKey === 'pk-a') {
    test.check('reply unblocks the offer');
  } else {
    test.fail('reply: ' + JSON.stringify({ answered: answered, got: got }));
  }

  const late = q.take();
  if (late === null) test.check('slot empty after reply');
  else test.fail('late take: ' + JSON.stringify(late));

  const timed = q.offer('secret', 'pk-c');
  const expired = await timed;
  if (expired && expired.ok === false && expired.error === 'not now') {
    test.check('timeout is not now');
  } else {
    test.fail('timeout: ' + JSON.stringify(expired));
  }

  const emptyPw = await q.offer('', 'pk-d');
  if (emptyPw && emptyPw.ok === false && emptyPw.error === 'not now') {
    test.check('empty password is not now');
  } else {
    test.fail('empty: ' + JSON.stringify(emptyPw));
  }

  const nodeHome = tmpHome();
  const box = createRelay(nodeHome);
  const house = auth.generateIdentity('andy');
  const phone = auth.generateIdentity('device');
  const claimed = box.claim(
    'andy',
    auth.sign(house.privateKey, auth.claimMessage('andy')),
    house.publicKey
  );
  if (!claimed.ok) test.fail('claim: ' + JSON.stringify(claimed));
  else test.check('lab owner');

  deviceAuth.ensurePassword(nodeHome);
  const door = deviceAuth.load(nodeHome).password;
  const offerP = box.deviceOffer(door, phone.publicKey);
  const held = box.deviceTake();
  if (!held || held.password !== door) {
    test.fail('relay take: ' + JSON.stringify(held));
  } else {
    test.check('relay held the POST in RAM');
  }

  if (!deviceAuth.passwordsEqual(door, held.password)) {
    test.fail('node would reject');
  } else {
    test.check('node accepts the password');
  }

  const installed = box.setDevice(
    'andy',
    held.devicePublicKey,
    auth.sign(house.privateKey, deviceAuth.setDeviceMessage(held.devicePublicKey))
  );
  if (!installed.ok) test.fail('install: ' + JSON.stringify(installed));
  else test.check('node wrote the device key');

  box.deviceReply(true);
  const browser = await offerP;
  if (browser.ok) test.check('browser POST completes');
  else test.fail('browser: ' + JSON.stringify(browser));

  const disk = path.join(nodeHome, 'relay-state', 'mailbox.json');
  let mailbox = '';
  try { mailbox = fs.readFileSync(disk, 'utf8'); } catch (e) { mailbox = ''; }
  if (mailbox.indexOf(door) === -1) test.check('password not in mailbox.json');
  else test.fail('password leaked into mailbox.json');
}

// The tally runs after the promise settles either way — a suite whose
// whole body is async still has to say what it counted, and one that
// threw has to say that too rather than exiting quiet and green.
run()
  .catch(function (e) {
    test.fail(String(e && e.stack ? e.stack : e));
  })
  .then(function () {
    test.reportSuccessFailureCount();
  });
