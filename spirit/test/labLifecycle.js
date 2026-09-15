'use strict';

// spirit/test/labLifecycle.js
// The lab control plane: make a node, start it, delete it, and leave the
// one Andy works in alone.
//
// ── THIS WAS labMaster/relayPing.test.js ─────────────────────────────
//
// Renamed because the name was describing the third of it that no longer
// exists. Eleven checks: eight were labMaster's own lifecycle and three
// were a "ping" — claim, send, inbox — across a transport that R8
// deleted. The ping is gone; what is left is what the file was mostly
// testing all along, which is why it is kept rather than deleted.
//
// The claim it used to make is covered better elsewhere and in the
// harness: spirit/test/relayGates.js drives signed and unsigned claims
// in process, and spirit/test/liveFrontDoor.js posts between real nodes.
// Neither of those can say whether labMaster can BUILD a node, and
// nothing else could either — which is this file's subject.
//
// ── AND IT IS IN THE HARNESS NOW ─────────────────────────────────────
//
// It sat in spirit/test/labMaster/, which runAll.js does not read, and
// it assumed somebody had started labMaster by hand. Both are fixed:
// labMaster/ensureMaster.js brings the control plane up if it is not
// already there, and the file lives with the other suites.
//
// Seconds, not milliseconds — it spawns real processes on real ports.
// That is the cost of the thing it proves, and it is paid deliberately:
// this suite and its two siblings went months without going red anywhere
// precisely because nothing ran them.

const test = require('./testSupport.js');
const lab = require('./labMaster/ensureMaster.js');

// Inside labMaster's own 65400-65429 range. Distinct from every other
// lab suite's ports so the harness can run them in the same lane pass —
// labPersistence takes 65419, labRefusals 65415, labWorld 65425-65428.
const RELAY_PORT = 65410;
const AVATAR_PORT = 65411;

// Prefixed so they can never be mistaken for, or delete, a row Andy
// keeps by hand. This suite touches nothing it did not make.
const RELAY_NAME = 'ping-relay';
const AVATAR_NAME = 'ping-andy';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function waitUntil(fn, timeoutMs, label) {
  const startedAt = Date.now();
  for (;;) {
    /* eslint-disable no-await-in-loop */
    let ok = false;
    try { ok = await fn(); } catch (e) { ok = false; }
    if (ok) return true;
    if (Date.now() - startedAt > timeoutMs) throw new Error('timeout waiting for ' + label);
    await sleep(200);
  }
}

async function serving(port) {
  try {
    const res = await fetch('http://127.0.0.1:' + port + '/api/relay/who');
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

// Best effort. A row left behind by a killed run must not fail the next
// one — the suite's subject is that it CAN clean up, asserted below, not
// that it always managed to last time.
async function ensureGone(id) {
  try { await lab.api('POST', '/api/nodes/' + id + '/delete', {}); } catch (e) { /* fine */ }
}

test.startTest('The lab control plane — build a node, start it, take it away');

async function run() {
  const ready = await lab.ensure();
  if (!ready.ok) {
    // NOT A PRODUCT FAILURE, and said as one line rather than as a dozen
    // red checks about relays. The lesson presenceWire paid for.
    test.fail('no lab: ' + ready.error);
    return;
  }

  await ensureGone(RELAY_NAME);
  await ensureGone(AVATAR_NAME);

  test.subHeading('A row is made, and it is a copy of the tree under test');

  const madeRelay = await lab.api('POST', '/api/nodes',
    { name: RELAY_NAME, type: 'relay', port: RELAY_PORT });
  if (madeRelay.status === 201 && madeRelay.json && madeRelay.json.node) {
    test.check('labMaster creates a relay row');
  } else {
    test.fail('create relay: ' + madeRelay.status + ' ' + madeRelay.text);
  }

  const madeAvatar = await lab.api('POST', '/api/nodes',
    { name: AVATAR_NAME, type: 'avatar', port: AVATAR_PORT });
  if (madeAvatar.status === 201) {
    test.check('and an avatar row beside it');
  } else {
    test.fail('create avatar: ' + madeAvatar.status + ' ' + madeAvatar.text);
  }

  test.subHeading('And it starts, and answers as itself');

  const startedRelay = await lab.api('POST', '/api/nodes/' + RELAY_NAME + '/start', {});
  if (startedRelay.status === 200) {
    test.check('the relay starts');
  } else {
    test.fail('start relay: ' + startedRelay.status + ' ' + startedRelay.text);
  }

  const startedAvatar = await lab.api('POST', '/api/nodes/' + AVATAR_NAME + '/start', {});
  if (startedAvatar.status === 200) {
    test.check('and so does the avatar');
  } else {
    test.fail('start avatar: ' + startedAvatar.status + ' ' + startedAvatar.text);
  }

  // A STARTED ROW IS NOT A SERVING PROCESS. labMaster answers 200 when it
  // has spawned something; whether that something got as far as listening
  // is a different question and the only one that matters to a caller.
  let up = false;
  try {
    await waitUntil(function () { return serving(RELAY_PORT); }, 10000, 'relay on ' + RELAY_PORT);
    up = true;
  } catch (e) { up = false; }
  if (up) {
    test.check('and the relay is really listening — a started row is not a serving process');
  } else {
    test.fail('the relay never answered /api/relay/who on ' + RELAY_PORT);
  }

  test.subHeading('It can take them away again, and knows what is not its own');

  const goneAvatar = await lab.api('POST', '/api/nodes/' + AVATAR_NAME + '/delete', {});
  if (goneAvatar.status === 200) {
    test.check('the avatar is deleted');
  } else {
    test.fail('delete avatar: ' + goneAvatar.status + ' ' + goneAvatar.text);
  }

  const goneRelay = await lab.api('POST', '/api/nodes/' + RELAY_NAME + '/delete', {});
  if (goneRelay.status === 200) {
    test.check('and so is the relay');
  } else {
    test.fail('delete relay: ' + goneRelay.status + ' ' + goneRelay.text);
  }

  const table = await lab.api('GET', '/api/nodes', null);
  const ids = ((table.json && table.json.nodes) || []).map(function (n) { return n.id; });

  if (ids.indexOf(RELAY_NAME) === -1 && ids.indexOf(AVATAR_NAME) === -1) {
    test.check('both rows are off the table — delete deletes, rather than stopping');
  } else {
    test.fail('rows still listed: ' + ids.join(','));
  }

  // THE ONE THAT IS NOT ABOUT THE LAB. `work` is the node Andy actually
  // uses, on 65432, and a suite that swept it would cost him his own
  // box. Checked every run, because "it cleans up after itself" and "it
  // cleans up after everybody" look identical until the day they don't.
  if (ids.indexOf('work') !== -1) {
    test.check('and the work row is untouched — a suite sweeps only what it made');
  } else {
    test.fail('the work row is missing from the table: ' + ids.join(','));
  }
}

run()
  .catch(function (err) { test.fail(String((err && err.message) || err)); })
  .then(function () {
    lab.stop();
    test.reportSuccessFailureCount();
  });
