'use strict';

// spirit/test/queueRestart.js
// A MESSAGE THIS NODE PROMISED TO SEND OUTLIVES THE PROCESS (cycle R16).
//
//   Andy: patience "could be days for a text message" — and days means
//   restarts.
//
// A "restart" here is a second peerPost built over the same store, which
// is exactly what a new process does: it has nothing in memory, and what
// it knows it reads back from node.db.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const peerPost = require('../run/js/peerPost');
const nodeStore = require('../run/js/nodeStore');
const trafficLog = require('../run/js/trafficLog');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function home() {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-queuerestart-'));
  auth.saveIdentity(h, auth.generateIdentity('sender'));
  return h;
}

const RELAY = 'http://relay.example';
const TO = auth.generateIdentity('someone').publicKey;

// A relay that refuses with whatever it is told, and counts what it saw.
function fakeRelay(answer) {
  const seen = [];
  return {
    seen: seen,
    request: function (url, method, pathname, body) {
      seen.push(body);
      return Promise.resolve({ status: answer.status, text: JSON.stringify(answer.body || {}) });
    },
  };
}

function logLines(h) {
  try {
    return fs.readFileSync(path.join(h, 'relay-state', 'traffic.jsonl'), 'utf8')
      .split(/\r?\n/).filter(Boolean).map(function (l) { return JSON.parse(l); });
  } catch (e) { return []; }
}

test.startTest('The post queue outlives the process');

async function run() {
  test.subHeading('A queued message is written down, and its backoff with it');

  const H = home();
  const store = nodeStore.open(H);
  const busy = fakeRelay({ status: 503, body: { error: 'target is busy', busy: true, retryAfterMs: 60000 } });
  const first = peerPost.createPeerPost({ rootDir: H, request: busy.request, waitMs: 2000, store: store });

  // A day's patience, a busy target: the first attempt is refused and the
  // entry waits, which is the state a restart has to preserve.
  first.post(RELAY, TO, 'a letter that must not be lost', null, { patienceMs: 86400000 });
  await sleep(150);

  const rows = store.queue.all();
  if (rows.length === 1 && rows[0].toKey === TO && rows[0].attempts === 1 &&
      JSON.parse(rows[0].body).text === 'a letter that must not be lost') {
    test.check('the message is on disc, with its body and the one attempt it has had');
  } else {
    test.fail('queue rows: ' + JSON.stringify(rows));
  }

  const pairs = store.backoff.all();
  if (pairs.length === 1 && pairs[0].untilWall > Date.now() + 50000) {
    test.check('and so is the backoff the busy target earned');
  } else {
    test.fail('backoff rows: ' + JSON.stringify(pairs));
  }

  test.subHeading('A new process takes it back, and respects the backoff');

  // THE RESTART. Nothing in memory; everything from node.db.
  const after = fakeRelay({ status: 503, body: { error: 'target is busy', busy: true, retryAfterMs: 60000 } });
  peerPost.createPeerPost({ rootDir: H, request: after.request, waitMs: 2000, store: store });
  await sleep(150);

  // A NODE THAT CRASHED MUST NOT HAMMER A TARGET IT WAS TOLD TO LEAVE
  // ALONE. The backoff came back, so nothing is sent yet.
  if (after.seen.length === 0) {
    test.check('the restored message waits out the backoff it had earned rather than going at once');
  } else {
    test.fail('sent ' + after.seen.length + ' time(s) straight after restart');
  }

  test.subHeading('When it may go, it goes — the same message, the same hash');

  {
    const H2 = home();
    const store2 = nodeStore.open(H2);
    const dead = fakeRelay({ status: 503, body: { error: 'target is busy', busy: true, retryAfterMs: 60000 } });
    const before = peerPost.createPeerPost({ rootDir: H2, request: dead.request, waitMs: 2000, store: store2 });
    before.post(RELAY, TO, 'resume me', null, { patienceMs: 86400000 });
    await sleep(150);
    const stored = JSON.parse(store2.queue.all()[0].body);

    // The backoff runs out while the node is down.
    store2.backoff.put(RELAY, TO, Date.now() - 1000, 60000);

    const live = fakeRelay({ status: 503, body: { error: 'peer not reachable' } });
    peerPost.createPeerPost({ rootDir: H2, request: live.request, waitMs: 2000, store: store2 });
    await sleep(200);

    const resent = live.seen[0];
    if (resent && resent.to === TO) {
      test.check('the restored message is sent again once its backoff has passed');
    } else {
      test.fail('nothing was resent: ' + JSON.stringify(live.seen));
    }

    // THE SAME SIGNED BYTES. A resumed message is not a new message: it
    // carries the signature and hash it was logged under, so the log's
    // "sent" entry and whatever finally settles it are one exchange.
    if (resent && resent.sig === stored.sig && resent.text === stored.text) {
      test.check('and it is the same signed message, not a new one written in its place');
    } else {
      test.fail('resent differs from stored: ' + JSON.stringify({ resent: resent, stored: stored }));
    }
  }

  test.subHeading('A message whose patience ran out while the node was down says so');

  {
    // THE GAP THIS CLOSES, which had no name. A node that died mid-send
    // left a "sent" entry in the permanent log with no outcome, for ever.
    const H3 = home();
    const store3 = nodeStore.open(H3);
    const body = { from: 'x', to: TO, text: '{"v":1}', sig: 'y' };
    store3.queue.put({
      hash: 'HASH-EXPIRED', relayUrl: RELAY, toKey: TO, kind: '',
      body: JSON.stringify(body), bytes: 7, attempts: 1,
      atWall: Date.now() - 7200000, untilWall: Date.now() - 3600000,
    });

    const never = fakeRelay({ status: 200, body: {} });
    const traffic = trafficLog.createTrafficLog({ rootDir: H3 });
    peerPost.createPeerPost({ rootDir: H3, request: never.request, waitMs: 2000, store: store3, traffic: traffic });
    await sleep(200);

    if (never.seen.length === 0) {
      test.check('a message whose deadline passed while the node was down is not sent');
    } else {
      test.fail('an expired message was sent');
    }

    // THE LOG SAYS WHY, not only that it failed: `code` is the catalogue's
    // (R36). An earlier draft of this check looked for the words "gave up"
    // in the row and found none, because the log kept a status and no
    // meaning — which is the retrofit this check now asserts.
    const gaveUp = logLines(H3).filter(function (l) { return l.hash === 'HASH-EXPIRED'; });
    const ending = gaveUp[gaveUp.length - 1];
    if (ending && ending.code === 'gave-up') {
      test.check('and the log records that it gave up — no "sent" entry is left without an ending');
    } else {
      test.fail('no outcome logged: ' + JSON.stringify(gaveUp));
    }

    if (store3.queue.all().length === 0) {
      test.check('and its row leaves the disc');
    } else {
      test.fail('the expired row stayed: ' + JSON.stringify(store3.queue.all()));
    }
  }

  test.subHeading('No store, no disc — a relay\'s own peerPost is unchanged');

  {
    const H4 = home();
    const plain = fakeRelay({ status: 503, body: { error: 'peer not reachable' } });
    const P = peerPost.createPeerPost({ rootDir: H4, request: plain.request, waitMs: 2000 });
    await P.post(RELAY, TO, 'no store here');
    if (!fs.existsSync(nodeStore.dbPath(H4))) {
      test.check('a peerPost given no store writes nothing and creates no node.db');
    } else {
      test.fail('node.db appeared without a store being given');
    }
  }

  test.reportSuccessFailureCount();
  // Restored queues keep a wake timer; nothing else here holds the loop.
  process.exit(0);
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
  process.exit(1);
});
