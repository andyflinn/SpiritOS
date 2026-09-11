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
const { createHub } = require('../run/js/hub');

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

  // B1: name first. Omitted resolves to the owner label, which is the
  // path today's device.html takes — exercised in deviceHandshakeTest.js.
  const offerP = box.deviceOffer('andy', doc.password, phone.publicKey);

  // The fifth argument is headers. The proof arrives there now, never on
  // the path — so this stands in for the route by reading it off the
  // header and handing it to the gated call, the way server.js does.
  async function requestFn(url, method, pth, body, headers) {
    if (method === 'GET' && /device-pending/.test(pth)) {
      if (/[?&]sig=/.test(pth)) {
        test.fail('the tick put a signature on the query string');
        return {};
      }
      const sig = (headers && (headers['X-Spirit-Sig'] || headers['x-spirit-sig'])) || '';
      const held = box.devicePending('andy', sig);
      return held || {};
    }
    if (method === 'POST' && /set-device/.test(pth)) {
      return box.setDevice(body.name, body.devicePublicKey, body.sig);
    }
    if (method === 'POST' && /device-answer/.test(pth)) {
      return box.deviceReply(body.name, !!body.accepted);
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
  const offerWrong = wrongBox.deviceOffer(
    'andy',
    live.split('').reverse().join(''),
    phone.publicKey
  );

  async function rejectFn(url, method, pth, body, headers) {
    if (method === 'GET' && /device-pending/.test(pth)) {
      const sig = (headers && (headers['X-Spirit-Sig'] || headers['x-spirit-sig'])) || '';
      return wrongBox.devicePending('andy', sig) || {};
    }
    if (method === 'POST' && /set-device/.test(pth)) {
      test.fail('setDevice must not run on a wrong password');
      return { ok: false };
    }
    if (method === 'POST' && /device-answer/.test(pth)) {
      return wrongBox.deviceReply(body.name, !!body.accepted);
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

  await bootBehaviour();

  if (typeof test.reportSuccessFailureCount === 'function') {
    test.reportSuccessFailureCount();
  }
}

// The window has to survive a restart. Until now the flag persisted and
// nothing read it at startup, so every restart shut the door silently —
// and the owner of that door is routinely nowhere near the machine.
async function bootBehaviour() {
  test.subHeading('The window survives a restart');

  // An older device.json has no `listening` field. Absent means nobody
  // decided, and the default that cannot strand anybody is open.
  const bare = tmpHome();
  fs.mkdirSync(path.join(bare, 'relay-state'), { recursive: true });
  fs.writeFileSync(
    path.join(bare, 'relay-state', 'device.json'),
    JSON.stringify({ password: 'x'.repeat(deviceAuth.PASSWORD_HEX_LEN), devicePublicKey: null })
  );
  if (deviceAuth.load(bare).listening === true) {
    test.check('a file with no listening field reads as open');
  } else {
    test.fail('bare doc: ' + JSON.stringify(deviceAuth.load(bare)));
  }

  // Written down, and honoured. The switch has to mean something or it is
  // chrome.
  deviceAuth.setListening(bare, false);
  if (deviceAuth.load(bare).listening === false) {
    test.check('and an explicit false is kept, so the switch still shuts it');
  } else {
    test.fail('after setListening(false): ' + JSON.stringify(deviceAuth.load(bare)));
  }

  // Shut is shut: boot must not reopen a door somebody closed on purpose.
  const shut = createHub(bare);
  const shutUrls = await shut.resumeListening();
  if (Array.isArray(shutUrls) && shutUrls.length === 0 && !listeningOf(shut)) {
    test.check('and resuming a shut window starts nothing');
  } else {
    test.fail('shut resume: ' + JSON.stringify(shutUrls) + ' listening=' + listeningOf(shut));
  }

  // Default-on costs nothing on a node nobody has configured: the door
  // needs a password to open, and a timer whose every pass is a no-op is
  // noise on every fake peer in the lab.
  const fresh = tmpHome();
  const freshHub = createHub(fresh);
  await freshHub.resumeListening();
  if (!listeningOf(freshHub)) {
    test.check('and a node with no password starts nothing, though it defaults open');
  } else {
    test.fail('a passwordless node started a timer');
  }

  // The case this exists for: the flag says open, a password exists, the
  // process restarts. The door comes back by itself.
  const kept = tmpHome();
  auth.saveIdentity(kept, auth.generateIdentity('andy'));
  deviceAuth.ensurePassword(kept);
  deviceAuth.setListening(kept, true);
  const keptHub = createHub(kept);
  await keptHub.resumeListening();
  if (listeningOf(keptHub)) {
    test.check('but a window left open comes back open after a restart');
  } else {
    test.fail('a kept-open window did not resume');
  }

  // AT ONCE, not one tick later. setInterval alone puts the first pass a
  // whole DEVICE_TICK_MS after the window opens, and that is the one gap
  // the rendezvous rule cannot cover: a hold that outlasts a pass still
  // cannot outlast a pass that has not started. It matters most in the
  // order a person actually uses — open the relay page on the phone
  // first, then start listening at home.
  //
  // Asserted on the EVENT rather than on a timer, because the event is
  // what the panel shows and what proved the poll was alive on spirit-3.
  await settle();
  const first = lastEventOf(keptHub);
  if (first && first.did) {
    test.check('and it looks straight away rather than a minute later — first pass: ' + first.did);
  } else {
    test.fail('no pass had happened by the time the window was open');
  }
}

// Long enough for a pass with no relays to fall through deviceTick and
// land in deviceLastEvent; far short of a tick, so passing here cannot
// mean the interval fired.
function settle() {
  return new Promise(function (resolve) { setTimeout(resolve, 250); });
}

// What /api/hub/device reports, which is the TIMER and not the file — the
// live answer, so the panel cannot claim to be listening while nothing is.
function lastEventOf(hub) {
  let body = '';
  hub.handleDevice({}, {
    writeHead: function () {},
    end: function (text) { body = text; },
  });
  try { return JSON.parse(body).lastEvent; }
  catch (e) { return null; }
}

function listeningOf(hub) {
  let body = '';
  hub.handleDevice({}, {
    writeHead: function () {},
    end: function (text) { body = text; },
  });
  try { return JSON.parse(body).listening === true; }
  catch (e) { return false; }
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  if (typeof test.reportSuccessFailureCount === 'function') {
    test.reportSuccessFailureCount();
  }
});
