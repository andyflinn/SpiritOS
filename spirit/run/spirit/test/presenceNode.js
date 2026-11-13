'use strict';

// spirit/run/spirit/test/presenceNode.js
// The tests of spirit/presenceNode.js, and of no other module (spec: ./presenceNode.md). Its own test, owed since the
// rule "every production script has its own test" (goal/G47.1, box v72).
//
// The personal node's half of presence: one held stream to every relay it holds a seat on, merged into one table,
// published to the shell as news of spirit.contact. In process, on a scratch folder holding an identity and two seated
// relays; the stream (connectImpl), the router, the jobs and every hook are planted, and each stream is driven by
// calling the onOpen, onEvent and onClose its connect was handed, which is what a relay does to this module.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
require(path.join(RUN, 'spirit', 'spirit.js'));
const PN = require(path.join(RUN, 'spirit', 'presenceNode.js'));
const auth = require(path.join(RUN, 'spirit', 'relayAuth.js'));
const relayKeys = require(path.join(RUN, 'spirit', 'relayKeys.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = function () { return new Promise(function (r) { setTimeout(r, 30); }); };

const URL_A = 'https://relay-a.example';
const URL_B = 'https://relay-b.example';
const KEY_RA = auth.generateIdentity('ra').publicKey;
const KEY_RB = auth.generateIdentity('rb').publicKey;
const FRIEND = 'friend-key';
const STRANGER = 'stranger-key';
const BOOK = { 'friend-key': true, 'friend2-key': true };

// What the planted world saw.
const W = { home: null, me: null, p: null, streams: {}, news: [], posts: [], seen: [], requests: [], replies: [], reports: [], edges: [], relayEvents: [], ownerEvents: [], routes: [], faces: [], pins: [], clock: 5000, started: null };
function plantedRouter() {
  return {
    onRequest: function (url, data) { W.requests.push({ url: url, data: data }); },
    onReply: function (data) { W.replies.push(data); },
    post: function (url, key, packet) {
      W.posts.push({ url: url, key: key, packet: JSON.parse(packet) });
      const body = JSON.parse(packet).body || {};
      // The relay's own search: on relay A it names the friend and a stranger; relay B refuses the verb.
      if (body.search && url === URL_A) return Promise.resolve({ text: JSON.stringify({ body: { ok: true, matches: [{ publicKey: 'friend2-key' }, { publicKey: STRANGER }] } }) });
      if (body.search) return Promise.reject(new Error('unknown verb'));
      return Promise.resolve({ text: '{}' });
    },
  };
}
function presence(extra) {
  return PN.createPresence(Object.assign({
    rootDir: W.home,
    router: plantedRouter(),
    jobs: { ownJob: function (id) { return { id: id }; }, ownNews: function (id, kind, data) { W.news.push({ id: id, kind: kind, data: JSON.parse(JSON.stringify(data)) }); } },
    connectImpl: function (o) { const s = { opts: o, closed: 0, close: function () { s.closed += 1; } }; W.streams[o.url] = s; return s; },
    now: function () { return W.clock; },
    knows: function (k) { return !!BOOK[k]; },
    noteSeen: function (k, row) { W.seen.push({ key: k, row: row }); },
    pinRelay: function (url) { W.pins.push(url); return Promise.resolve(); },
    recordReport: function (url, data) { W.reports.push({ url: url, data: data }); },
    recordEdge: function (url, edge, reason) { W.edges.push([url, edge, reason]); },
    onRelayEvent: function (row) { W.relayEvents.push(row); },
    onOwnerEvent: function (ev) { W.ownerEvents.push(ev); },
    onRoute: function (url, data) { W.routes.push({ url: url, data: data }); },
    onFace: function (url, data) { W.faces.push(['face', url, data]); },
    onFaceOpen: function (url, data) { W.faces.push(['open', url, data]); },
    onFaceClose: function (url) { W.faces.push(['close', url]); },
  }, extra || {}));
}
function stream(url) { return W.streams[PN.streamUrl(url, W.me && W.me.publicKey)]; }
function event(url, name, data) { stream(url).opts.onEvent({ event: name, data: data }); }
function dot(key) { const t = W.p.table(); return t[key] ? (t[key].present ? 'green' : 'red') : 'white'; }

// ── the construction ──
test.run('createPresence refuses to be built without the router it posts from (half an interface)', 0.2, function () {
  try { PN.createPresence({ rootDir: os.tmpdir() }); return 'built with no router'; }
  catch (e) { return /router/.test(e.message) || 'threw ' + e.message; }
}, test.limit.quick);
test.run('streamUrl is the relay\'s stream door with the key in its query, a trailing slash dropped', 0.2, function () {
  const u = PN.streamUrl('https://r.example//', 'a+b/c');
  return u === 'https://r.example/api/relay/stream?key=a%2Bb%2Fc' || u;
}, test.limit.quick);

// ── the world ──
test.run('the world: a scratch node with an identity, seated on two relays, started', 0.2, async function () {
  W.home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-presencenode-'));
  auth.saveIdentity(W.home, auth.generateIdentity('presencenode-test'));
  W.me = auth.loadIdentity(W.home);
  [[URL_A, KEY_RA], [URL_B, KEY_RB]].forEach(function (r) { relayKeys.list(W.home, r[0], r[0], r[1]); relayKeys.seat(W.home, r[0]); });
  W.p = presence();
  W.started = await W.p.start(function () { return Promise.resolve({ status: 200, text: '{}' }); });
  return (!!W.me && short((W.started || []).slice().sort()) === short([URL_A, URL_B])) || 'started on ' + short(W.started);
}, test.limit.quick);
test.run('start opens one stream to each seated relay, at its stream door, under this node\'s key', 0.2, function () {
  if (!W.started) return 'not started: the world failed';
  return (!!stream(URL_A) && !!stream(URL_B) && Object.keys(W.streams).length === 2) || 'streams ' + short(Object.keys(W.streams));
}, test.limit.quick);
test.run('start owns the spirit.contact job (goal/G43.20)', 0.2, function () {
  if (!W.started) return 'not started: the world failed';
  return W.p.jobId() === 'spirit.contact' || 'job ' + short(W.p.jobId());
}, test.limit.quick);
test.run('each attempt is signed afresh, in a header, for that relay\'s pinned key alone', 0.2, function () {
  if (!W.started) return 'not started: the world failed';
  const h = stream(URL_A).opts.headers();
  const sig = h['X-Spirit-Sig'];
  const good = auth.verify(W.me.publicKey, auth.streamMessage(W.me.publicKey, KEY_RA), sig);
  const forB = auth.verify(W.me.publicKey, auth.streamMessage(W.me.publicKey, KEY_RB), sig);
  return (good === true && forB === false && stream(URL_A).opts.url.indexOf('Sig') === -1) || 'verifies for A ' + good + ', for B ' + forB;
}, test.limit.quick);
test.run('the relay\'s key is pinned as its stream opens', 0.2, function () {
  if (!W.started) return 'not started: the world failed';
  return (W.pins.indexOf(URL_A) !== -1 && W.pins.indexOf(URL_B) !== -1) || 'pinned ' + short(W.pins);
}, test.limit.quick);

// ── a stream opens ──
test.run('the world: both streams open', 0.2, async function () {
  if (!W.started) return 'not started: the world failed';
  stream(URL_A).opts.onOpen(); stream(URL_B).opts.onOpen();
  await settle();
  return W.news.length > 0 || 'nothing published';
}, test.limit.quick);
test.run('on open, the relay itself and this node are present, each a proof {present, at} (goal/G2.9)', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  const d = W.p.detail()[URL_A] || {};
  return (short(d[KEY_RA]) === short({ present: true, at: 5000 }) && short(d[W.me.publicKey]) === short({ present: true, at: 5000 })) || 'relay A says ' + short(d);
}, test.limit.quick);
test.run('on open, the node hands the relay its card, sealed to the relay\'s key (cycle 10, R20)', 0.2, function () {
  const cards = W.posts.filter(function (x) { return x.packet.app === 'relay' && x.packet.body && x.packet.body.card; });
  return (cards.length === 2 && cards.some(function (x) { return x.url === URL_A && x.key === KEY_RA; })) || 'card posts ' + short(cards.map(function (x) { return x.url; }));
}, test.limit.quick);
test.run('on open, the book is reconciled once with the relay\'s own search (goal/G2.8): the contact it names is green', 0.2, function () {
  const asks = W.posts.filter(function (x) { return x.packet.body && x.packet.body.search; });
  return (asks.length === 2 && asks[0].packet.body.search.q === '*' && dot('friend2-key') === 'green') || 'asks ' + asks.length + ', friend2 ' + dot('friend2-key');
}, test.limit.quick);
test.run('what the search names outside the book is learned, not drawn', 0.2, function () {
  const noted = W.seen.some(function (s) { return s.key === STRANGER; });
  return (noted && dot(STRANGER) === 'white') || 'noted ' + noted + ', stranger ' + dot(STRANGER);
}, test.limit.quick);
test.run('a relay that refuses the search marks nobody and keeps its stream', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  const b = W.p.detail()[URL_B] || {};
  return (!b['friend2-key'] && stream(URL_B).closed === 0) || 'relay B says ' + short(b);
}, test.limit.quick);
test.run('the open edge is recorded', 0.2, function () {
  return W.edges.some(function (e) { return e[0] === URL_A && e[1] === 'open'; }) || 'edges ' + short(W.edges);
}, test.limit.quick);
test.run('the table goes to the shell as news of spirit.contact, { presence } and nothing else', 0.2, function () {
  const n = W.news[W.news.length - 1] || {};
  return (n.id === 'spirit.contact' && n.kind === 'presence' && short(Object.keys(n.data || {})) === '["presence"]' && !!n.data.presence[KEY_RA]) || 'news ' + short(n);
}, test.limit.quick);

// ── broadcasts: the relay broadcasts, the node filters ──
test.run('a present broadcast for a contact makes it green', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  W.clock = 6000;
  event(URL_A, 'presence', { key: FRIEND, present: true });
  return dot(FRIEND) === 'green' || 'friend ' + dot(FRIEND);
}, test.limit.quick);
test.run('a broadcast for a stranger is seen (R27) but not drawn', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  const before = W.seen.length;
  event(URL_A, 'presence', { key: 'other-stranger', present: true });
  return (W.seen.length === before + 1 && W.seen[before].key === 'other-stranger' && dot('other-stranger') === 'white') || 'seen ' + short(W.seen.slice(before)) + ', ' + dot('other-stranger');
}, test.limit.quick);
test.run('the same word twice is no news: the job is not told again', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  const before = W.news.length;
  event(URL_A, 'presence', { key: FRIEND, present: true });
  return W.news.length === before || (W.news.length - before) + ' news for nothing new';
}, test.limit.quick);
test.run('across relays present wins: absent on one, present on another, is green', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  event(URL_B, 'presence', { key: FRIEND, present: true });
  event(URL_A, 'presence', { key: FRIEND, present: false });
  return (dot(FRIEND) === 'green' && W.p.table()[FRIEND].present === true && short(W.p.relaysNaming(FRIEND)) === short([URL_B])) || 'friend ' + dot(FRIEND) + ', naming ' + short(W.p.relaysNaming(FRIEND));
}, test.limit.quick);
test.run('absent everywhere it is named is red', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  event(URL_B, 'presence', { key: FRIEND, present: false });
  return (dot(FRIEND) === 'red' && W.p.relaysNaming(FRIEND).length === 0) || 'friend ' + dot(FRIEND);
}, test.limit.quick);
test.run('gone is not absent: the key leaves, and named nowhere it is white', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  event(URL_A, 'presence', { key: FRIEND, gone: true });
  event(URL_B, 'presence', { key: FRIEND, gone: true });
  return dot(FRIEND) === 'white' || 'friend ' + dot(FRIEND);
}, test.limit.quick);

// ── heard: a relay just carried this key ──
test.run('heard: a relay with a stream marks a contact green and answers true', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  W.clock = 7000;
  const ok = W.p.heard(URL_B, FRIEND);
  return (ok === true && dot(FRIEND) === 'green' && W.p.detail()[URL_B][FRIEND].at === 7000) || 'heard ' + ok + ', friend ' + dot(FRIEND);
}, test.limit.quick);
test.run('heard: a relay with no stream answers false; a stranger is not drawn', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  const got = [W.p.heard('https://nowhere.example', FRIEND), W.p.heard(URL_B, 'yet-another'), W.p.heard(URL_B, '')];
  return (short(got) === short([false, true, false]) && dot('yet-another') === 'white') || 'heard ' + short(got);
}, test.limit.quick);

// ── the rest of what the stream carries ──
test.run('a request goes to the router with its relay, a reply to the router', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  event(URL_A, 'request', { hash: 'h1' }); event(URL_A, 'reply', { hash: 'h2' });
  return (W.requests.length === 1 && W.requests[0].url === URL_A && W.requests[0].data.hash === 'h1' && W.replies.length === 1 && W.replies[0].hash === 'h2') || short([W.requests, W.replies]);
}, test.limit.quick);
test.run('a route goes to onRoute; the face\'s request, open and close to their hooks (goal/G30.13)', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  event(URL_A, 'route', { key: FRIEND, at: URL_A });
  event(URL_A, 'face', { q: 1 }); event(URL_A, 'face-open', { s: 1 }); event(URL_A, 'face-close', {});
  return (W.routes.length === 1 && W.routes[0].data.key === FRIEND && short(W.faces.map(function (f) { return f[0]; })) === short(['face', 'open', 'close'])) || short([W.routes, W.faces]);
}, test.limit.quick);
test.run('a relay-status report is kept as the latest, recorded, and nudged to the page carrying the report (goal/G41.32)', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  event(URL_A, 'relay-status', { members: 3 });
  const nudge = W.relayEvents.filter(function (e) { return e.kind === 'status'; })[0] || {};
  return (W.p.relayStatus()[URL_A].members === 3 && W.reports.length === 1 && W.reports[0].url === URL_A && nudge.relay === URL_A && nudge.report && nudge.report.members === 3) || short([W.p.relayStatus(), W.reports, nudge]);
}, test.limit.quick);
test.run('a burst of reports is paced: no second nudge within the second, and the latest is kept', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  const before = W.relayEvents.length;
  event(URL_A, 'relay-status', { members: 4 }); event(URL_A, 'relay-status', { members: 5 });
  return (W.relayEvents.length === before && W.reports.length === 3 && W.p.relayStatus()[URL_A].members === 5) || 'nudges ' + (W.relayEvents.length - before) + ', reports ' + W.reports.length;
}, test.limit.quick);
test.run('a relay-event and an owner-event are handed on, stamped with their relay', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  event(URL_B, 'relay-event', { kind: 'post' }); event(URL_B, 'owner-event', { kind: 'claim' });
  const re = W.relayEvents.filter(function (e) { return e.kind === 'post'; })[0] || {};
  const oe = W.ownerEvents[0] || {};
  return (re.kind === 'post' && re.relay === URL_B && oe.kind === 'claim' && oe.relay === URL_B) || short([re, oe]);
}, test.limit.quick);
test.run('handOverCardEverywhere hands the card to every open stream at once, answering how many', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  const before = W.posts.filter(function (x) { return x.packet.body && x.packet.body.card; }).length;
  const n = W.p.handOverCardEverywhere();
  const after = W.posts.filter(function (x) { return x.packet.body && x.packet.body.card; }).length;
  return (n === 2 && after === before + 2) || 'answered ' + n + ', cards ' + (after - before);
}, test.limit.quick);

// ── a stream closes ──
test.run('a closed stream stops asserting: what only it said is gone, the close edge recorded', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  event(URL_A, 'presence', { key: 'friend2-key', present: true });
  stream(URL_A).opts.onClose('ended');
  return (!W.p.detail()[URL_A] && dot(KEY_RA) === 'white' && dot(FRIEND) === 'green' && W.edges.some(function (e) { return e[0] === URL_A && e[1] === 'close' && e[2] === 'ended'; })) || short([Object.keys(W.p.detail()), dot(KEY_RA), dot(FRIEND), W.edges]);
}, test.limit.quick);
test.run('stop closes every stream and empties the table', 0.2, function () {
  if (!W.p) return 'no presence: the world failed';
  W.p.stop();
  return (stream(URL_A).closed === 1 && stream(URL_B).closed === 1 && short(W.p.table()) === '{}') || short([stream(URL_A).closed, stream(URL_B).closed, W.p.table()]);
}, test.limit.quick);

// ── no filter given ──
test.run('with no knows, every key is kept (the in-process suites)', 0.2, async function () {
  if (!W.home) return 'no scratch folder: the world failed';
  W.streams = {};
  const p = presence({ knows: undefined });
  await p.start(function () { return Promise.resolve({ status: 200, text: '{}' }); });
  stream(URL_A).opts.onOpen();
  stream(URL_A).opts.onEvent({ event: 'presence', data: { key: STRANGER, present: true } });
  const ok = !!p.table()[STRANGER];
  p.stop();
  return ok || 'the stranger was filtered with no filter given';
}, test.limit.quick);
test.run('start with nothing to ask opens nothing and answers []', 0.2, async function () {
  if (!W.home) return 'no scratch folder: the world failed';
  W.streams = {};
  const got = await presence().start();
  return (short(got) === '[]' && Object.keys(W.streams).length === 0) || 'started ' + short(got);
}, test.limit.quick);
