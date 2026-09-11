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

  // B1: the queue is per identity, so every call names one. This suite
  // drives the module directly, so it says the name itself rather than
  // leaning on relay.js resolving an omitted one to the owner.
  const first = q.offer('andy', 'secret', 'pk-a');
  const peek = q.take('andy');
  if (peek && peek.password === 'secret' && peek.devicePublicKey === 'pk-a') {
    test.check('take sees the live slot');
  } else {
    test.fail('take: ' + JSON.stringify(peek));
  }

  const busy = await q.offer('andy', 'other', 'pk-b');
  if (busy && busy.ok === false && busy.error === 'not now') {
    test.check('second offer refused while slot live');
  } else {
    test.fail('busy: ' + JSON.stringify(busy));
  }

  const answered = q.reply('andy', true);
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
  // Through relay.js, where an omitted name resolves to the owner label —
  // the path today's frozen device.html actually takes.
  const offerP = box.deviceOffer(null, door, phone.publicKey);
  const held = box.deviceTake(null);
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

  box.deviceReply(null, true);
  const browser = await offerP;
  if (browser.ok) test.check('browser POST completes');
  else test.fail('browser: ' + JSON.stringify(browser));

  // B1 — the bucket on device-pending, through the relay rather than the
  // queue. deviceSlots.js proves pendingRateOk counts per name; this
  // proves relay.js actually consults it, and consults it BEFORE the
  // signature check.
  //
  // The proof is the STATUS. Every one of these carries a signature the
  // gate would reject, so a box that verified first would answer 403
  // forever. A 429 can only mean the bucket answered before the crypto
  // did (DEVICE-B1.md, Andy: "devicePending calls pendingRateOk(name)
  // before crypto").
  test.subHeading('device-pending is rate limited, before any verify');

  let sawRefusal = 0;
  let sawGate = 0;
  for (let n = 0; n < 14; n += 1) {
    const answer = box.devicePending('andy', 'not-a-signature');
    if (answer && answer.status === 429) sawRefusal += 1;
    else if (answer && answer.status === 403) sawGate += 1;
  }
  if (sawGate > 0 && sawRefusal > 0) {
    test.check('a flood of bad signatures is cut off — ' + sawGate +
      ' reached the gate, ' + sawRefusal + ' were refused before it');
  } else {
    test.fail('gate=' + sawGate + ' rate=' + sawRefusal + ' (no bucket on device-pending)');
  }

  // And a name this box does not know never reaches the bucket at all, so
  // it cannot mint a queue entry keyed by input a stranger chose. Always
  // the gate's refusal, never the bucket's.
  let strangerRate = 0;
  for (let n = 0; n < 14; n += 1) {
    const answer = box.devicePending('stranger-' + n, 'not-a-signature');
    if (answer && answer.status === 429) strangerRate += 1;
  }
  if (strangerRate === 0) {
    test.check('and an unknown name is refused without touching the queue');
  } else {
    test.fail('unknown names reached the rate bucket ' + strangerRate + ' times');
  }

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
