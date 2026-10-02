'use strict';

// goal/G2.8: the agents' nodes show green — a fresh stream reconciles the book against the relay once. Red on
// today's tree.
//   Found by Andy, 2026-10-02: "also, none of you appear as \"present\"", "and your nodes should be showing green
//   dots", "in Find someone on the network you do show green".
//   Live, the same day (jobs.get on each node's relay-presence job): his node opened its stream after the agents'
//   nodes had connected, and its table never gained their keys — presenceNode.js marks green only from a broadcast
//   heard since its own stream opened (onChange), and the relay sends no roster on connect (cycle 3). The network
//   search shows them green because the relay answers it from who is connected now.
// The contract the builder follows (wsl-claude's shape, read back under goal/G2.8, unopposed; Andy's own rule
// reused — a list is a search):
//   1. When a stream to a relay opens (onOpen, every open — a boot and every reconnection), the node asks that
//      relay once, through the router it already posts from, the relay's own `search` (the packet hub.handleSearch
//      sends: {v: 1, body: {search: {q}}}, sealed to the relay's pinned key); nothing new on the wire.
//   2. Every match the relay answers that is in this node's book (knows) is marked present at that relay, exactly
//      as a `present: true` broadcast would have marked it, and published once. A book contact the answer does not
//      name stays unmentioned (white), never red: not being in a capped answer is not being absent.
//   3. A match not in the book is learned (noteSeen, as a broadcast is: "learn first, then decide what to draw")
//      and not drawn.
//   4. A relay that fails the question (a rejected post, a refusal) marks nobody and breaks nothing: the stream
//      stays, broadcasts still land.
//   5. Nothing is asked before the stream is open, and nothing twice for one open.
// Open, named here so the builder does not guess: a capped answer (more: true) that misses a book contact — does the
// node ask again, per missing key, or accept white until the broadcast? Not asserted; the builder says in its commit.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const presenceNode = require('../run/js/presenceNode');
const relayKeys = require('../run/js/relayKeys');

const OWED = 'OWED by goal/G2.8: ';
const JOHN = 'MCowBQYDK2VwAyEAjohnjohnjohnjohnjohnjohnjohnjohnjohn=';
const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
const ZOE = 'MCowBQYDK2VwAyEAzoezoezoezoezoezoezoezoezoezoezoezoe=';
const RELAY = 'http://a';
const RELAYKEY = 'MCowBQYDK2VwAyEArelayrelayrelayrelayrelayrelayrelayre=';

function tmpHome() { return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-presence-reconcile-')); }
function keyDoor() { return Promise.resolve({ status: 200, text: JSON.stringify({ relayPublicKey: RELAYKEY, relayLabel: 'lab' }) }); }
function fakeJobs() {
  const j = { updates: [], job: null };
  j.createJob = function (kind, type, data) { j.job = { id: 'job_1', kind: kind, type: type, data: data }; return j.job; };
  j.updateJob = function (id, patch) { if (patch.data) Object.assign(j.job.data, patch.data); j.updates.push(patch); return j.job; };
  return j;
}
// The post half, recording and answering: a search packet gets the scripted answer, anything else an empty text.
function fakeRouter(script) {
  const r = { requests: [], replies: [], posts: [] };
  r.onRequest = function (url, data) { r.requests.push({ url: url, data: data }); };
  r.onReply = function (data) { r.replies.push(data); };
  r.post = function (url, toKey, text) {
    let body = null;
    try { body = JSON.parse(text).body; } catch (e) { body = null; }
    r.posts.push({ url: url, toKey: toKey, body: body });
    if (body && body.search) return script(url, body.search);
    return Promise.resolve({ text: '' });
  };
  return r;
}
function answer(matches, more) {
  return Promise.resolve({ text: JSON.stringify({ body: { ok: true, matches: matches, more: !!more } }) });
}
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }
// What the table says about a key: true, false, or undefined for nobody having said. Each value is a proof,
// {present, at} (goal/G2.9).
function said(table, key) { return table[key] ? table[key].present : undefined; }
function searches(router) { return router.posts.filter(function (p) { return p.body && p.body.search; }); }

// A node with john and bert in its book, seated and pinned on one relay, its stream captured.
function node(script) {
  const home = tmpHome();
  const me = auth.generateIdentity('me');
  auth.saveIdentity(home, me);
  fs.mkdirSync(path.join(home, 'shell', 'natter'), { recursive: true });
  fs.writeFileSync(path.join(home, 'shell', 'natter', 'relays.json'), JSON.stringify([{ label: 'a', url: RELAY }]));
  relayKeys.seat(home, RELAY, 'me');
  relayKeys.accept(home, RELAY, RELAYKEY);
  const book = {}; book[JOHN] = true; book[BERT] = true;
  const learned = [];
  const router = fakeRouter(script);
  const jobs = fakeJobs();
  let stream = null;
  const P = presenceNode.createPresence({
    rootDir: home, jobs: jobs, router: router,
    knows: function (key) { return book[key] === true; },
    noteSeen: function (key, what) { learned.push({ key: key, what: what }); },
    connectImpl: function (o) { stream = o; return { close: function () {} }; },
  });
  return { home: home, me: me, P: P, router: router, jobs: jobs, learned: learned, stream: function () { return stream; } };
}

test.startTest('goal/G2.8: a fresh stream reconciles the book against the relay once');

(async function () {
  test.subHeading('1, 2, 3. the open asks the relay once; the connected contacts go green, the rest stay white');
  const n = node(function () { return answer([{ publicKey: JOHN, publicLabel: 'John' }, { publicKey: ZOE, publicLabel: 'Zoe' }]); });
  await n.P.start(keyDoor);
  const s = n.stream();
  if (!s) { test.fail(OWED + 'no stream was opened to ' + RELAY + ' — the fixture cannot drive the open'); return; }
  if (searches(n.router).length === 0) test.check('5. nothing is asked before the stream is open');
  else test.fail(OWED + 'a search went out before the stream opened');
  s.onOpen();
  await settled();
  const asked = searches(n.router);
  if (asked.length === 1 && asked[0].url === RELAY && asked[0].toKey === RELAYKEY && typeof asked[0].body.search.q === 'string') {
    test.check('one search packet, to the relay, sealed to its pinned key — the relay\'s own verb, nothing new');
  } else test.fail(OWED + 'searches after the open: ' + JSON.stringify(asked));
  const t = n.P.table();
  if (said(t, JOHN) === true && said(t, BERT) === undefined && said(t, ZOE) === undefined) {
    test.check('john, connected and in the book, is green; bert, in the book and not named, stays white; zoe, not in the book, is not drawn');
  } else test.fail(OWED + 'the table after the answer: john ' + JSON.stringify(t[JOHN]) + ', bert ' + JSON.stringify(t[BERT]) + ', zoe ' + JSON.stringify(t[ZOE]));
  const zoeLearned = n.learned.some(function (l) { return l.key === ZOE && l.what && l.what.url === RELAY; });
  if (zoeLearned) test.check('zoe is learned (noteSeen, with the relay) though not drawn — as a broadcast about her would be');
  else test.fail(OWED + 'zoe was not learned: ' + JSON.stringify(n.learned));
  const published = n.jobs.updates.filter(function (u) { return u.data && u.data.presence && said(u.data.presence, JOHN) === true; });
  if (published.length >= 1) test.check('the job carries john present, so the Contacts dot paints without a broadcast');
  else test.fail(OWED + 'no job update carried john present: ' + JSON.stringify(n.jobs.updates.map(function (u) { return u.data; })));

  test.subHeading('broadcasts still land after the reconcile, and a reconnection asks again');
  s.onEvent({ event: 'presence', data: { key: BERT, present: true } });
  if (said(n.P.table(), BERT) === true) test.check('bert goes green on his broadcast');
  else test.fail('bert after his broadcast: ' + JSON.stringify(n.P.table()[BERT]));
  s.onClose('gone');
  s.onOpen();
  await settled();
  if (searches(n.router).length === 2) test.check('the second open asks once more — every open, never twice for one');
  else test.fail(OWED + 'searches after a close and a second open: ' + searches(n.router).length);
  if (said(n.P.table(), JOHN) === true) test.check('and john is green again after the reconnection, with no broadcast');
  else test.fail(OWED + 'john after the second open: ' + JSON.stringify(n.P.table()[JOHN]));

  test.subHeading('4. a relay that fails the question marks nobody and breaks nothing');
  const f = node(function () { return Promise.reject(new Error('relay down')); });
  await f.P.start(keyDoor);
  const fs2 = f.stream();
  let tripped = null;
  try { fs2.onOpen(); await settled(); } catch (e) { tripped = e; }
  const ft = f.P.table();
  if (!tripped && said(ft, JOHN) === undefined && said(ft, BERT) === undefined) test.check('nobody marked, nothing thrown');
  else test.fail(OWED + 'after a failed search: ' + (tripped ? 'threw ' + tripped.message : 'table ' + JSON.stringify(ft)));
  fs2.onEvent({ event: 'presence', data: { key: JOHN, present: true } });
  if (said(f.P.table(), JOHN) === true) test.check('and a broadcast still lands on that stream');
  else test.fail('john after a broadcast on the failed-search stream: ' + JSON.stringify(f.P.table()[JOHN]));
  const r = node(function () { return Promise.resolve({ text: JSON.stringify({ body: { ok: false, error: 'no such peer' } }) }); });
  await r.P.start(keyDoor);
  r.stream().onOpen();
  await settled();
  if (said(r.P.table(), JOHN) === undefined && said(r.P.table(), BERT) === undefined) test.check('an older relay refusing the verb marks nobody either');
  else test.fail(OWED + 'after a refusal: ' + JSON.stringify(r.P.table()));
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
});
