'use strict';

// goal/G4.32: each post's closing traffic row records how long it waited in the queue (busy retries included) and how
// many tries it took. Red on today's tree; wsl-claude wrote it, claude-windows builds it.
//   Found under goal/G4.30 (2026-10-04): the "sent" row is written when a post ENTERS the queue (peerPost.js 977-980,
//   note before queue.add), and a busy retry leaves no row, so a post that waited 5 s behind a busy target read as
//   5 s of flight; wsl-claude and claude-windows both misread retries from it.
//   Andy, 2026-10-04: "what could be proven: how much time is spent from entering the queue to actually being posted,
//   an interesting stat could be had from that."; to Q7 (record it on the traffic row): "i'm for it: because it is a
//   problem area, and a possible indicator for the ouside world (relay/peer) not keeping up anymore."; "i like to know
//   every step of our dear little packets."; the grant for js/peerPost.js (G1, G2) and his Go on goal/G4.32.
//
// THE SHAPES (claude-windows's laying-out under goal/G4.30; the builder may argue them in Desk first):
//   1  The closing row of a post (receipted, refused, no-answer) carries waitMs: from entering the queue to the start
//      of the attempt that finally left, busy waits included; and attempts: how many tries it took.
//   2  Its existing ms stays queued-to-end, so ms - waitMs is the flight.
//   3  No schema change: the traffic table keeps fields it does not name in its extra column (nodeStore.js 116).
//      BUT trafficLog.note() copies a fixed list of fields into the row (trafficLog.js, note: dir, kind, ... ms,
//      payload), so the two new ones must be added there too: a second core file, js/trafficLog.js, with its grant.
//
// FOUND IN THE DRY RUN: patching peerPost.js alone left both fields off the row (note() dropped them); with
//   trafficLog.js's note() copying waitMs and attempts as it copies ms, 5 of 5.
//
// THE WORLD: a real peerPost with a real traffic log in a scratch home; its relay is a stand-in `request` that answers
// "target is busy" twice (retryAfterMs 5000, as router.js quotes) and accepts the third, after which a receipt signed
// by the target arrives, as the stream would carry it. With goal/G4.30's adaptive retry the two busy waits are 250 and
// 500 ms.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const peerPost = require('../run/js/peerPost');
const trafficLog = require('../run/js/trafficLog');

const OWED = 'OWED by goal/G4.32: ';
const RELAY = 'https://relay.test';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function removeHome(home) {
  try { require('../run/js/nodeStore.js').open(home).close(); } catch (e) { /* no store */ }
  fs.rmSync(home, { recursive: true, force: true });
}

test.startTest('goal/G4.32: a post\'s closing row says how long it waited and how many tries it took');

// THE PROCESS IS KEPT ALIVE while a post waits: the queue's retry timer does not hold the event loop (a node's servers
// do that), so without this the suite would end mid-wait with nothing reported.
const keepAlive = setInterval(function () {}, 1000);

(async function () {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-postwait-'));
  const me = auth.generateIdentity('sender');
  const target = auth.generateIdentity('target');
  auth.saveIdentity(home, me);
  const traffic = trafficLog.createTrafficLog({ rootDir: home, relayMode: false });
  let P = null;
  let busyLeft = 0;
  const posts = [];
  // The stand-in relay: busy while busyLeft lasts, then accepted, and the target's receipt follows 100 ms later.
  const request = function (url, method, pathname, body) {
    if (pathname !== '/api/relay/post') return Promise.resolve({ status: 404, text: '{}' });
    posts.push(Date.now());
    if (busyLeft > 0) {
      busyLeft -= 1;
      return Promise.resolve({ status: 503, text: JSON.stringify({ error: 'target is busy', busy: true, retryAfterMs: 5000 }) });
    }
    const verified = auth.postSignatureFor(body.from, body.from, body.to, body.text, body.sig);
    const hash = verified ? auth.requestHash(verified) : '';
    setTimeout(function () {
      P.onReply({ hash: hash, from: target.publicKey, text: '', sig: auth.sign(target.privateKey, auth.receiptMessage(hash)) });
    }, 100);
    return Promise.resolve({ status: 202, text: JSON.stringify({ ok: true, hash: hash, grantedMs: 5000 }) });
  };
  P = peerPost.createPeerPost({ rootDir: home, request: request, traffic: traffic, sealKeyFor: function () { return target.sealPublicKey; }, waitMs: 4000 });

  const closing = function (hash) {
    return traffic.read().filter(function (r) { return r.hash === hash && r.dir === 'in' && r.kind === 'reply'; })[0] || null;
  };

  test.subHeading('1. a post that met a busy target twice');
  busyLeft = 2;
  const t0 = Date.now();
  const busy = await P.post(RELAY, target.publicKey, 'a question', undefined, { patienceMs: 20000 });
  const took = Date.now() - t0;
  if (busy && busy.ok && posts.length === 3) test.check('the world: two busy answers, the third accepted and receipted, in ' + took + ' ms');
  else { test.fail('the world: the post answered ' + JSON.stringify(busy) + ' after ' + posts.length + ' tries'); removeHome(home); return; }
  const row = closing(busy.hash);
  if (row && row.attempts === 3) test.check('its closing row says attempts 3');
  else test.fail(OWED + 'the closing row reads ' + JSON.stringify(row));
  const waited = posts[2] - t0;
  if (row && typeof row.waitMs === 'number' && Math.abs(row.waitMs - waited) <= 150) test.check('its closing row says waitMs ' + row.waitMs + ' (the third try left ' + waited + ' ms after the post was made)');
  else test.fail(OWED + 'waitMs is ' + (row && row.waitMs) + ', while the third try left ' + waited + ' ms after the post was made');
  if (row && typeof row.ms === 'number' && typeof row.waitMs === 'number' && row.ms - row.waitMs >= 0 && row.ms - row.waitMs < 1000) test.check('ms - waitMs is the flight: ' + (row.ms - row.waitMs) + ' ms');
  else test.fail(OWED + 'ms ' + (row && row.ms) + ' and waitMs ' + (row && row.waitMs) + ' do not leave the flight');

  test.subHeading('2. a post that went at once');
  posts.length = 0;
  busyLeft = 0;
  const quick = await P.post(RELAY, target.publicKey, 'another', undefined, { patienceMs: 20000 });
  const row2 = quick && closing(quick.hash);
  if (row2 && row2.attempts === 1 && typeof row2.waitMs === 'number' && row2.waitMs < 100) test.check('attempts 1, waitMs ' + row2.waitMs);
  else test.fail(OWED + 'the closing row reads ' + JSON.stringify(row2));

  await sleep(50);
  removeHome(home);
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  clearInterval(keepAlive);
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 100);
});
