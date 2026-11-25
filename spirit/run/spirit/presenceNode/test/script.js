'use strict';

// spirit/run/spirit/presenceNode/test/script.js
// The tests of spirit/presenceNode/script.js, and of no other module (spec: ./script.md). Its own test, owed since the
// rule "every production script has its own test" (goal/G47.1, box v72).
//
// The personal node's half of presence: one held stream to every relay it holds a seat on, merged into one table,
// published to the shell as news of spirit.contact. In process, on a scratch folder holding an identity and two seated
// relays; the stream (connectImpl), the router, the jobs and every hook are planted, and each stream is driven by
// calling the onOpen, onEvent and onClose its connect was handed, which is what a relay does to this module.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../../tempFolder/script.js').tempFolder;
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/presenceNode/' + name + tempAsked); }
// ITS STORES CLOSED BEFORE ITS FOLDER GOES (goal/G48.4; Andy, of the 0.7s: "it leaves no temp folder behind"): on Windows a
// folder holding an open database cannot be removed, and nodeStore keeps each store it opened open; every one under the
// suite's folder (a node.db at <root>/spirit/state/node.db) is closed first.
function closeStoresUnder(top) {
  const NS = S.requireScript('spirit/nodeStore/script.js');
  (function walk(dir, depth) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return; }
    if (names.indexOf('node.db') !== -1 && path.basename(dir) === 'state') { try { NS.open(path.dirname(path.dirname(dir))).close(); } catch (e) { /* closed */ } }
    if (depth > 6) return;
    names.forEach(function (n) { const p = path.join(dir, n); try { if (fs.statSync(p).isDirectory()) walk(p, depth + 1); } catch (e) { /* gone */ } });
  }(top, 0));
}
test.after(function () {
  const top = tempFolder.path('spirit/test/presenceNode');
  closeStoresUnder(top);
  try { fs.rmSync(top, { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ }
});
require(path.join(RUN, 'spirit', 'script.js'));
const PN = S.requireScript('spirit/presenceNode/script.js');
const auth = S.requireScript('spirit/relayAuth/script.js');
const relayKeys = S.requireScript('spirit/relayKeys/script.js');

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
const W = { home: null, me: null, p: null, streams: {}, news: [], posts: [], seen: [], requests: [], replies: [], edges: [], relayEvents: [], ownerEvents: [], routes: [], faces: [], pins: [], clock: 5000, started: null };
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
    onEdge: function (url, edge, reason) { W.edges.push([url, edge, reason]); },
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
  try { PN.createPresence({ rootDir: ownTemp('noRouter') }); return false; }
  catch (e) { return /router/.test(e.message) || false; }
}, test.limit.quick);
test.run('streamUrl is the relay\'s stream door with the key in its query, a trailing slash dropped', 0.2, function () {
  const u = PN.streamUrl('https://r.example//', 'a+b/c');
  return u === 'https://r.example/spirit/relay/stream?key=a%2Bb%2Fc' || false;
}, test.limit.quick);

// ── the world ──
test.run('a scratch node with an identity, seated on two relays, is started', 0.2, async function () {
  W.home = ownTemp('spirit-presencenode-');
  auth.saveIdentity(W.home, auth.generateIdentity('presencenode-test'));
  W.me = auth.loadIdentity(W.home);
  [[URL_A, KEY_RA], [URL_B, KEY_RB]].forEach(function (r) { relayKeys.list(W.home, r[0], r[0], r[1]); relayKeys.seat(W.home, r[0]); });
  W.p = presence();
  W.started = await W.p.start(function () { return Promise.resolve({ status: 200, text: '{}' }); });
  return (!!W.me && short((W.started || []).slice().sort()) === short([URL_A, URL_B])) || false;
}, test.limit.quick);
test.run('start opens one stream to each seated relay, at its stream door, under this node\'s key', 0.2, function () {
  if (!W.started) return false;
  return (!!stream(URL_A) && !!stream(URL_B) && Object.keys(W.streams).length === 2) || false;
}, test.limit.quick);
test.run('start owns the spirit.contact job', 0.2, function () {
  if (!W.started) return false;
  return W.p.jobId() === 'spirit.contact' || false;
}, test.limit.quick);
test.run('each attempt is signed afresh, in a header, for that relay\'s pinned key alone', 0.2, function () {
  if (!W.started) return false;
  const h = stream(URL_A).opts.headers();
  const sig = h['X-Spirit-Sig'];
  const good = auth.verify(W.me.publicKey, auth.streamMessage(W.me.publicKey, KEY_RA), sig);
  const forB = auth.verify(W.me.publicKey, auth.streamMessage(W.me.publicKey, KEY_RB), sig);
  return (good === true && forB === false && stream(URL_A).opts.url.indexOf('Sig') === -1) || false;
}, test.limit.quick);
test.run('the relay\'s key is pinned as its stream opens', 0.2, function () {
  if (!W.started) return false;
  return (W.pins.indexOf(URL_A) !== -1 && W.pins.indexOf(URL_B) !== -1) || false;
}, test.limit.quick);

// ── a stream opens ──
test.run('both streams open', 0.2, async function () {
  if (!W.started) return false;
  stream(URL_A).opts.onOpen(); stream(URL_B).opts.onOpen();
  await settle();
  return W.news.length > 0 || false;
}, test.limit.quick);
test.run('on open, the relay itself and this node are present, each a proof that says it is present and when', 0.2, function () {
  if (!W.p) return false;
  const d = W.p.detail()[URL_A] || {};
  return (short(d[KEY_RA]) === short({ present: true, at: 5000 }) && short(d[W.me.publicKey]) === short({ present: true, at: 5000 })) || false;
}, test.limit.quick);
test.run('on open, the node hands the relay its card, sealed to the relay\'s key', 0.2, function () {
  const cards = W.posts.filter(function (x) { return x.packet.app === 'relay' && x.packet.body && x.packet.body.card; });
  return (cards.length === 2 && cards.some(function (x) { return x.url === URL_A && x.key === KEY_RA; })) || false;
}, test.limit.quick);
test.run('on open, the book is reconciled once with the relay\'s own search, and the contact it names is green', 0.2, function () {
  const asks = W.posts.filter(function (x) { return x.packet.body && x.packet.body.search; });
  return (asks.length === 2 && asks[0].packet.body.search.q === '*' && dot('friend2-key') === 'green') || false;
}, test.limit.quick);
test.run('what the search names outside the book is learned, not drawn', 0.2, function () {
  const noted = W.seen.some(function (s) { return s.key === STRANGER; });
  return (noted && dot(STRANGER) === 'white') || false;
}, test.limit.quick);
test.run('a relay that refuses the search marks nobody and keeps its stream', 0.2, function () {
  if (!W.p) return false;
  const b = W.p.detail()[URL_B] || {};
  return (!b['friend2-key'] && stream(URL_B).closed === 0) || false;
}, test.limit.quick);
test.run('the open edge is told to onEdge', 0.2, function () {
  return W.edges.some(function (e) { return e[0] === URL_A && e[1] === 'open'; }) || false;
}, test.limit.quick);
test.run('the table goes to the shell as news of spirit.contact, its presence and nothing else', 0.2, function () {
  const n = W.news[W.news.length - 1] || {};
  return (n.id === 'spirit.contact' && n.kind === 'presence' && short(Object.keys(n.data || {})) === '["presence"]' && !!n.data.presence[KEY_RA]) || false;
}, test.limit.quick);

// ── broadcasts: the relay broadcasts, the node filters ──
test.run('a present broadcast for a contact makes it green', 0.2, function () {
  if (!W.p) return false;
  W.clock = 6000;
  event(URL_A, 'presence', { key: FRIEND, present: true });
  return dot(FRIEND) === 'green' || false;
}, test.limit.quick);
test.run('a broadcast for a stranger is seen but not drawn', 0.2, function () {
  if (!W.p) return false;
  const before = W.seen.length;
  event(URL_A, 'presence', { key: 'other-stranger', present: true });
  return (W.seen.length === before + 1 && W.seen[before].key === 'other-stranger' && dot('other-stranger') === 'white') || false;
}, test.limit.quick);
test.run('the same word twice is no news: the job is not told again', 0.2, function () {
  if (!W.p) return false;
  const before = W.news.length;
  event(URL_A, 'presence', { key: FRIEND, present: true });
  return W.news.length === before || false;
}, test.limit.quick);
test.run('across relays present wins: absent on one, present on another, is green', 0.2, function () {
  if (!W.p) return false;
  event(URL_B, 'presence', { key: FRIEND, present: true });
  event(URL_A, 'presence', { key: FRIEND, present: false });
  return (dot(FRIEND) === 'green' && W.p.table()[FRIEND].present === true && short(W.p.relaysNaming(FRIEND)) === short([URL_B])) || false;
}, test.limit.quick);
test.run('absent everywhere it is named is red', 0.2, function () {
  if (!W.p) return false;
  event(URL_B, 'presence', { key: FRIEND, present: false });
  return (dot(FRIEND) === 'red' && W.p.relaysNaming(FRIEND).length === 0) || false;
}, test.limit.quick);
test.run('gone is not absent: the key leaves, and named nowhere it is white', 0.2, function () {
  if (!W.p) return false;
  event(URL_A, 'presence', { key: FRIEND, gone: true });
  event(URL_B, 'presence', { key: FRIEND, gone: true });
  return dot(FRIEND) === 'white' || false;
}, test.limit.quick);

// ── heard: a relay just carried this key ──
test.run('heard, for a relay with a stream, marks a contact green and answers true', 0.2, function () {
  if (!W.p) return false;
  W.clock = 7000;
  const ok = W.p.heard(URL_B, FRIEND);
  return (ok === true && dot(FRIEND) === 'green' && W.p.detail()[URL_B][FRIEND].at === 7000) || false;
}, test.limit.quick);
test.run('heard, for a relay with no stream, answers false, and a stranger it hears of is not drawn', 0.2, function () {
  if (!W.p) return false;
  const got = [W.p.heard('https://nowhere.example', FRIEND), W.p.heard(URL_B, 'yet-another'), W.p.heard(URL_B, '')];
  return (short(got) === short([false, true, false]) && dot('yet-another') === 'white') || false;
}, test.limit.quick);

// ── the rest of what the stream carries ──
test.run('a request goes to the router with its relay, a reply to the router', 0.2, function () {
  if (!W.p) return false;
  event(URL_A, 'request', { hash: 'h1' }); event(URL_A, 'reply', { hash: 'h2' });
  return (W.requests.length === 1 && W.requests[0].url === URL_A && W.requests[0].data.hash === 'h1' && W.replies.length === 1 && W.replies[0].hash === 'h2') || false;
}, test.limit.quick);
test.run('a route goes to onRoute; the face\'s request, open and close to their hooks', 0.2, function () {
  if (!W.p) return false;
  event(URL_A, 'route', { key: FRIEND, at: URL_A });
  event(URL_A, 'face', { q: 1 }); event(URL_A, 'face-open', { s: 1 }); event(URL_A, 'face-close', {});
  return (W.routes.length === 1 && W.routes[0].data.key === FRIEND && short(W.faces.map(function (f) { return f[0]; })) === short(['face', 'open', 'close'])) || false;
}, test.limit.quick);
test.run('a relay-status report is kept as the latest and nudged to the page carrying the report', 0.2, function () {
  if (!W.p) return false;
  event(URL_A, 'relay-status', { members: 3 });
  const nudge = W.relayEvents.filter(function (e) { return e.kind === 'status'; })[0] || {};
  return (W.p.relayStatus()[URL_A].members === 3 && nudge.relay === URL_A && nudge.report && nudge.report.members === 3) || false;
}, test.limit.quick);
test.run('a burst of reports is paced: no second nudge within the second, and the latest is kept', 0.2, function () {
  if (!W.p) return false;
  const before = W.relayEvents.length;
  event(URL_A, 'relay-status', { members: 4 }); event(URL_A, 'relay-status', { members: 5 });
  return (W.relayEvents.length === before && W.p.relayStatus()[URL_A].members === 5) || false;
}, test.limit.quick);
test.run('a relay-event and an owner-event are handed on, stamped with their relay', 0.2, function () {
  if (!W.p) return false;
  event(URL_B, 'relay-event', { kind: 'post' }); event(URL_B, 'owner-event', { kind: 'claim' });
  const re = W.relayEvents.filter(function (e) { return e.kind === 'post'; })[0] || {};
  const oe = W.ownerEvents[0] || {};
  return (re.kind === 'post' && re.relay === URL_B && oe.kind === 'claim' && oe.relay === URL_B) || false;
}, test.limit.quick);
test.run('handOverCardEverywhere hands the card to every open stream at once, answering how many', 0.2, function () {
  if (!W.p) return false;
  const before = W.posts.filter(function (x) { return x.packet.body && x.packet.body.card; }).length;
  const n = W.p.handOverCardEverywhere();
  const after = W.posts.filter(function (x) { return x.packet.body && x.packet.body.card; }).length;
  return (n === 2 && after === before + 2) || false;
}, test.limit.quick);

// ── a stream closes ──
test.run('a closed stream stops asserting: what only it said is gone, the close edge told to onEdge with its reason', 0.2, function () {
  if (!W.p) return false;
  event(URL_A, 'presence', { key: 'friend2-key', present: true });
  stream(URL_A).opts.onClose('ended');
  return (!W.p.detail()[URL_A] && dot(KEY_RA) === 'white' && dot(FRIEND) === 'green' && W.edges.some(function (e) { return e[0] === URL_A && e[1] === 'close' && e[2] === 'ended'; })) || false;
}, test.limit.quick);
test.run('stop closes every stream and empties the table', 0.2, function () {
  if (!W.p) return false;
  W.p.stop();
  return (stream(URL_A).closed === 1 && stream(URL_B).closed === 1 && short(W.p.table()) === '{}') || false;
}, test.limit.quick);

// ── no filter given ──
test.run('with no knows, every key is kept, as the in-process suites need', 0.2, async function () {
  if (!W.home) return false;
  W.streams = {};
  const p = presence({ knows: undefined });
  await p.start(function () { return Promise.resolve({ status: 200, text: '{}' }); });
  stream(URL_A).opts.onOpen();
  stream(URL_A).opts.onEvent({ event: 'presence', data: { key: STRANGER, present: true } });
  const ok = !!p.table()[STRANGER];
  p.stop();
  return ok || false;
}, test.limit.quick);
test.run('start with nothing to ask opens nothing and answers an empty list', 0.2, async function () {
  if (!W.home) return false;
  W.streams = {};
  const got = await presence().start();
  return (short(got) === '[]' && Object.keys(W.streams).length === 0) || false;
}, test.limit.quick);
