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

const fs = require('fs');
const os = require('os');
const path = require('path');
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

// A RELAY IS SERVING when its public census answers. Expressed through
// the one door below rather than opening a second: oneDoor.js counts
// every reach for the wire in every file, tests included, and a number
// that may only fall is the whole mechanism (AGENT.md, Comms).
async function serving(port) {
  const res = await hub(port, 'GET', '/api/relay/who', null);
  return res.status === 200;
}

// One loopback verb at one door, the way every caller asks now.
async function hub(port, method, pathname, body) {
  try {
    const res = await fetch('http://127.0.0.1:' + port + pathname, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    let parsed = null;
    try { parsed = await res.json(); } catch (e) { parsed = null; }
    return { status: res.status, body: parsed };
  } catch (e) {
    return { status: 0, body: null };
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
    { name: RELAY_NAME, type: 'relay', port: RELAY_PORT , kind: 'fixture' });
  if (madeRelay.status === 201 && madeRelay.json && madeRelay.json.node) {
    test.check('labMaster creates a relay row');
  } else {
    test.fail('create relay: ' + madeRelay.status + ' ' + madeRelay.text);
  }

  const madeAvatar = await lab.api('POST', '/api/nodes',
    { name: AVATAR_NAME, type: 'avatar', port: AVATAR_PORT , kind: 'fixture' });
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

  // ── A NODE THAT CLAIMS AFTER BOOT MUST CONNECT ─────────────────────
  //
  //   Andy: "now i have a new 'Jazzy Alexandra' and she's bound to
  //   spirit-3 but she cannot find anybody in contacts" — "her relay
  //   shows green."
  //
  // She had no `relay-presence` job at all. presenceNode.start returns at
  // its first line when the node has no identity, and a brand-new node
  // has none: it boots empty and the key is minted by the first CLAIM.
  // Nothing started presence again, so the node sat enrolled and
  // unconnected until somebody restarted it.
  //
  // EVERY NEW NODE GOES THROUGH EXACTLY THAT SEQUENCE, which is why this
  // is asserted here rather than left to the live suites: labWorld writes
  // an identity into a home and RESTARTS the node, so it has never once
  // walked the path a person walks.
  //
  // The green badge was not lying either, which is what made it hard to
  // see: it is read off the public census, and `claimed` means "you have
  // a row here" — a different question from "you are connected".
  test.subHeading('A node that claims after boot connects without a restart');

  // `serving` asks /api/relay/who, which only a RELAY answers. A personal
  // node is alive when its own door answers a verb — the same door every
  // caller uses.
  const relayUp = await serving(RELAY_PORT);

  // WAITED FOR, not assumed. The suite above waits for the relay to
  // listen and never waited for the avatar — a started row is not a
  // serving process, which is a sentence this file already carries about
  // the other one.
  let avatarUp = false;
  try {
    await waitUntil(async function () {
      const probe = await hub(AVATAR_PORT, 'POST', '/api/spirit', { verb: 'jobs.list' });
      return probe.status === 200;
    }, 10000, 'avatar on ' + AVATAR_PORT);
    avatarUp = true;
  } catch (e) { avatarUp = false; }
  if (!relayUp || !avatarUp) {
    test.fail('need both fixtures up: relay=' + relayUp + ' avatar=' + avatarUp);
  } else {
    // The avatar booted with no identity — a fresh clone of the tree, the
    // way a new node arrives. Before claiming it should have no presence
    // job, because there is nobody to be present AS.
    const before = await hub(AVATAR_PORT, 'POST', '/api/spirit', { verb: 'jobs.list' });
    const beforeKinds = ((before.body || []).map(function (j) { return j.type; }));

    if (beforeKinds.indexOf('relay-presence') === -1) {
      test.check('a node with no key holds no presence — there is nobody to be present as');
    } else {
      test.fail('presence before a key: ' + beforeKinds.join(', '));
    }

    // POINT IT AT THE FIXTURE RELAY FIRST. `withChosenRelay` refuses a
    // url the node does not list — deliberately, so a stale tab cannot
    // aim an owner-signed claim at a box the person never added — and
    // nothing exposes "configure this node's relays" from outside it, so
    // the file is written the way labWorld writes one.
    //
    // No restart needed: ownerBadge.loadRelays reads the file per call.
    const avatarHome = path.join(
      os.tmpdir(), 'spiritos-relay-fakes', AVATAR_NAME, 'spirit', 'run'
    );
    fs.mkdirSync(path.join(avatarHome, 'app', 'natter'), { recursive: true });
    fs.writeFileSync(
      path.join(avatarHome, 'app', 'natter', 'relays.json'),
      JSON.stringify([{ label: 'ping', url: 'http://127.0.0.1:' + RELAY_PORT }], null, 2)
    );

    // And claim, exactly as Natter does.
    const claimed = await hub(AVATAR_PORT, 'POST', '/api/spirit', {
      verb: 'relay.claim', url: 'http://127.0.0.1:' + RELAY_PORT, name: 'ping-andy',
    });
    if (claimed.status >= 200 && claimed.status < 300) {
      test.check('it can take a seat on the fixture relay');
    } else {
      test.fail('claim: ' + claimed.status + ' ' + JSON.stringify(claimed.body));
    }

    // NO RESTART between the claim and the question. That is the whole
    // assertion: the node that was just enrolled has to connect itself.
    let connected = false;
    try {
      await waitUntil(async function () {
        const after = await hub(AVATAR_PORT, 'POST', '/api/spirit', { verb: 'jobs.list' });
        return ((after.body || []).some(function (j) { return j.type === 'relay-presence'; }));
      }, 8000, 'presence after claim');
      connected = true;
    } catch (e) { connected = false; }

    if (connected) {
      test.check('and one that claims starts one, without being restarted');
    } else {
      test.fail('no relay-presence job after claiming — the node is enrolled and deaf');
    }
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
