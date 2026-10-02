'use strict';

// goal/G2.9, the feeding half: the live presence table learns from every moment a relay speaks. Red on today's
// tree.
//   Andy, 2026-10-02 (under goal/G2.8, verbatim): "... but presence is implied... by search results", "and every
//   incoming request?", then, shown that a network search painted the WSL nodes green while the contact list stayed
//   white: "looks like the search results don't make it into the contact list".
//   Checked in the tree: a search row (hub.js:2616) and an answered post (hub.js:78) write `present` into the shadow
//   roll, an arrival notes only its route (server.js:1342, rank ARRIVED) — and the contact list reads none of it: its
//   dot comes from the relay-presence job alone (contacts.js contactsWatchPresence), fed only by broadcasts heard on
//   an open stream and, since 21a2ea2d, the reconcile at open. So a Find, a delivered message or an incoming one
//   teach the dot nothing.
// The contract the builder follows (the shape in goal/G2.9's box, both agents; Andy's Go 2026-10-02):
//   1. presenceNode gains `heard(url, key)`: the relay at `url` has just carried `key` — the same mark a
//      `present: true` broadcast on that stream makes, published through the job the Contacts dot reads. A key not in
//      the book is not drawn, and not noted either: the caller wrote the shadow row already, that is why it is
//      calling. A relay this node holds no open stream to marks nothing (there is no live word to give) and `heard`
//      says so (false). The newest word wins: a key the relay had said absent goes green again on `heard`.
//   2. hub.handleSearch hears every row a relay answered, at the relay that was asked — a partner's member too
//      (claude-windows, G2.8 review: a route through the asked relay exists, so the dot is honest). A row memory
//      supplied is not heard: it is what the node already had, not evidence. A relay that fails the question hears
//      nobody.
//   3. hub.handlePost hears the peer at the relay the answer came back through, when the answer is ok. A refused
//      or unanswered post hears nobody here (what it teaches the shadow is learnPresence's, unchanged).
//   4. An arriving packet hears its sender at the relay it arrived through. That wiring is server.js's noteSeen
//      closure (server.js:1342, the one place that holds both the arrival and `presence`), which no unit here can
//      mount, and this file paints no vacuous green for it; it is verified live at review — a line from one agent's
//      node turns that agent green on the other's Contacts page without a restart. Named here so the builder does
//      not take silence for permission to skip it.
// Not asserted, named: a relay answering "peer not reachable" to a post is the relay speaking about its own member,
// and could mark `false` in the live table as its broadcast would. The builder says in its commit whether it does.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const presenceNode = require('../run/js/presenceNode');
const relayKeys = require('../run/js/relayKeys');
const hubModule = require('../run/js/hub');
const contactBook = require('../run/js/contacts');

const OWED = 'OWED by goal/G2.9: ';
const JOHN = 'MCowBQYDK2VwAyEAjohnjohnjohnjohnjohnjohnjohnjohnjohn=';
const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
const ZOE = 'MCowBQYDK2VwAyEAzoezoezoezoezoezoezoezoezoezoezoezoe=';
const RELAY = 'http://a';
const RELAY_B = 'http://b';
const RELAYKEY = 'MCowBQYDK2VwAyEArelayrelayrelayrelayrelayrelayrelayre=';
const RELAYKEY_B = 'MCowBQYDK2VwAyEArelaybrelaybrelaybrelaybrelaybrelaybr=';

function tmpHome(tag) { return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-presence-feeding-' + tag + '-')); }
function keyDoor() { return Promise.resolve({ status: 200, text: JSON.stringify({ relayPublicKey: RELAYKEY, relayLabel: 'lab' }) }); }
function fakeJobs() {
  const j = { updates: [], job: null };
  j.createJob = function (kind, type, data) { j.job = { id: 'job_1', kind: kind, type: type, data: data }; return j.job; };
  j.updateJob = function (id, patch) { if (patch.data) Object.assign(j.job.data, patch.data); j.updates.push(patch); return j.job; };
  return j;
}
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }

// A node with john and bert in its book, pinned on one relay, its stream captured; the relay answers the reconcile
// with nobody, so every green below is `heard`'s and not the open's.
function node() {
  const home = tmpHome('node');
  const me = auth.generateIdentity('me');
  auth.saveIdentity(home, me);
  fs.mkdirSync(path.join(home, 'shell', 'natter'), { recursive: true });
  fs.writeFileSync(path.join(home, 'shell', 'natter', 'relays.json'), JSON.stringify([{ label: 'a', url: RELAY }]));
  relayKeys.seat(home, RELAY, 'me');
  relayKeys.accept(home, RELAY, RELAYKEY);
  const book = {}; book[JOHN] = true; book[BERT] = true;
  const learned = [];
  const router = {
    onRequest: function () {}, onReply: function () {},
    post: function () { return Promise.resolve({ text: JSON.stringify({ body: { ok: true, matches: [], more: false } }) }); },
  };
  const jobs = fakeJobs();
  let stream = null;
  const P = presenceNode.createPresence({
    rootDir: home, jobs: jobs, router: router,
    knows: function (key) { return book[key] === true; },
    noteSeen: function (key, what) { learned.push({ key: key, what: what }); },
    connectImpl: function (o) { stream = o; return { close: function () {} }; },
  });
  return { P: P, jobs: jobs, learned: learned, stream: function () { return stream; } };
}

// The hub half: a home with a book, bound to RELAY (and RELAY_B when asked), the presence picture a recorder.
function hubHome(relays) {
  const H = tmpHome('hub');
  auth.saveIdentity(H, auth.generateIdentity('me'));
  fs.mkdirSync(path.join(H, 'shell', 'natter'), { recursive: true });
  fs.writeFileSync(path.join(H, 'shell', 'natter', 'relays.json'), JSON.stringify(relays));
  relays.forEach(function (r) { relayKeys.accept(H, r.url, r.key); });
  return H;
}
function recorder(naming) {
  const heard = [];
  return {
    heard: heard,
    presence: {
      relaysNaming: function (key) { return (naming && naming[key]) || []; },
      detail: function () { return {}; },
      heard: function (url, key) { heard.push({ url: url, key: key }); return true; },
    },
  };
}
function fakeRes(resolve) {
  const res = {
    status: 0,
    writeHead: function (s) { res.status = s; },
    setHeader: function () {},
    end: function (b) { let p = null; try { p = JSON.parse(b); } catch (e) { p = { raw: String(b) }; } resolve({ status: res.status, body: p }); },
  };
  return res;
}
function search(H, q, router, presence) {
  return new Promise(function (resolve) {
    hubModule.createHub(H).handleSearch({}, fakeRes(resolve), function () { return Promise.resolve({ q: q }); },
      { router: router, presence: presence });
  });
}
function post(H, to, router, presence) {
  return new Promise(function (resolve) {
    hubModule.createHub(H).handlePost({}, fakeRes(resolve), function () { return Promise.resolve({ to: to, text: 'hi' }); },
      { router: router, presence: presence });
  });
}
function relayAnswering(byUrl) {
  return {
    post: function (url, toKey, text) {
      let body = null;
      try { body = JSON.parse(text).body; } catch (e) { body = null; }
      if (body && body.search) {
        const rows = byUrl[url];
        if (rows === null) return Promise.reject(new Error('no answer within the wait'));
        return Promise.resolve({ text: JSON.stringify({ v: 1, body: { ok: true, matches: rows || [], more: false } }) });
      }
      // The partners question, for a via row: nobody known, so the row keeps the relay that answered it.
      return Promise.resolve({ text: JSON.stringify({ v: 1, body: { partners: [] } }) });
    },
  };
}
function heardOf(rec, key) { return rec.heard.filter(function (h) { return h.key === key; }); }

test.startTest('goal/G2.9: the live presence table learns from every moment a relay speaks');

(async function () {
  test.subHeading('1. presenceNode.heard(url, key) marks as a present broadcast would');
  const n = node();
  await n.P.start(keyDoor);
  const s = n.stream();
  if (!s) { test.fail(OWED + 'no stream was opened to ' + RELAY + ' — the fixture cannot drive the open'); return; }
  if (typeof n.P.heard !== 'function') {
    test.fail(OWED + 'presenceNode has no heard(url, key)');
  } else {
    let before = null;
    try { before = n.P.heard(RELAY, JOHN); } catch (e) { before = 'threw ' + e.message; }
    if (before === false && n.P.table()[JOHN] === undefined) test.check('before the stream opens there is no live word to give: heard says false and marks nobody');
    else test.fail(OWED + 'heard before the open: ' + JSON.stringify(before) + ', john ' + JSON.stringify(n.P.table()[JOHN]));
    s.onOpen();
    await settled();
    const learnedBefore = n.learned.length;
    const got = n.P.heard(RELAY, JOHN);
    if (got === true && n.P.table()[JOHN] === true) test.check('john, in the book, goes green when the relay he is on has just carried him');
    else test.fail(OWED + 'heard on an open stream: ' + JSON.stringify(got) + ', john ' + JSON.stringify(n.P.table()[JOHN]));
    const published = n.jobs.updates.filter(function (u) { return u.data && u.data.presence && u.data.presence[JOHN] === true; });
    if (published.length >= 1) test.check('and the job carries him present, so the Contacts dot paints');
    else test.fail(OWED + 'no job update carried john present');
    n.P.heard(RELAY, ZOE);
    if (n.P.table()[ZOE] === undefined) test.check('zoe, not in the book, is not drawn');
    else test.fail(OWED + 'zoe drawn: ' + JSON.stringify(n.P.table()[ZOE]));
    if (n.learned.length === learnedBefore) test.check('and heard notes nobody in the shadow — the caller already wrote that row');
    else test.fail(OWED + 'heard wrote the shadow: ' + JSON.stringify(n.learned.slice(learnedBefore)));
    const elsewhere = n.P.heard(RELAY_B, BERT);
    if (elsewhere === false && n.P.table()[BERT] === undefined) test.check('a relay this node holds no stream to gives no live word: false, nobody marked');
    else test.fail(OWED + 'heard at an unheld relay: ' + JSON.stringify(elsewhere) + ', bert ' + JSON.stringify(n.P.table()[BERT]));
    s.onEvent({ event: 'presence', data: { key: JOHN, present: false } });
    if (n.P.table()[JOHN] === false) test.check('the relay says john absent: red');
    else test.fail('john after an absent broadcast: ' + JSON.stringify(n.P.table()[JOHN]));
    n.P.heard(RELAY, JOHN);
    if (n.P.table()[JOHN] === true) test.check('then he speaks through that relay again: green — the newest word wins');
    else test.fail(OWED + 'john after heard following absent: ' + JSON.stringify(n.P.table()[JOHN]));
    s.onClose('gone');
    if (n.P.table()[JOHN] === undefined) test.check('the stream closes and that relay\'s word goes with it, as before');
    else test.fail('john after the close: ' + JSON.stringify(n.P.table()[JOHN]));
  }

  test.subHeading('2. a network search hears every row the relay answered, at the relay asked');
  const H = hubHome([{ label: 'a', url: RELAY, key: RELAYKEY }]);
  contactBook.acquire(H, { publicKey: JOHN, publicLabel: 'John' }, 'handle');
  hubModule.shadow(H).note(BERT, { at: RELAYKEY, url: RELAY, label: 'Bert remembered', present: true });
  const rec = recorder();
  const rows = {}; rows[RELAY] = [
    { publicKey: JOHN, publicLabel: 'John' },
    { publicKey: ZOE, publicLabel: 'Zoe', via: RELAYKEY_B },
  ];
  const on = await search(H, '*', relayAnswering(rows), rec.presence);
  if (on.status !== 200) test.fail('the search itself failed: ' + JSON.stringify(on.body));
  if (heardOf(rec, JOHN).length === 1 && heardOf(rec, JOHN)[0].url === RELAY) test.check('john, answered by the relay, is heard once at that relay');
  else test.fail(OWED + 'john heard: ' + JSON.stringify(heardOf(rec, JOHN)));
  if (heardOf(rec, ZOE).length === 1 && heardOf(rec, ZOE)[0].url === RELAY) test.check('zoe, a partner\'s member the relay carried, is heard at the relay asked — a route through it exists');
  else test.fail(OWED + 'zoe heard: ' + JSON.stringify(heardOf(rec, ZOE)));
  if (heardOf(rec, BERT).length === 0) test.check('bert, supplied by memory and answered by nobody, is not heard — a remembered row is not evidence');
  else test.fail(OWED + 'bert heard from memory: ' + JSON.stringify(heardOf(rec, BERT)));
  const down = recorder();
  const failing = {}; failing[RELAY] = null;
  await search(H, '*', relayAnswering(failing), down.presence);
  if (down.heard.length === 0) test.check('a relay that fails the question hears nobody');
  else test.fail(OWED + 'heard after a failed search: ' + JSON.stringify(down.heard));
  const bare = await search(H, '*', relayAnswering(rows), undefined);
  if (bare.status === 200) test.check('and a search with no presence picture to feed still answers (the lab and the suites mount it so)');
  else test.fail(OWED + 'a search without presence failed: ' + JSON.stringify(bare.body));

  test.subHeading('3. an answered post hears the peer at the relay the answer came through');
  const naming = {}; naming[JOHN] = [RELAY];
  const okRec = recorder(naming);
  const okRouter = { post: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h1', text: 'ack' }); } };
  const delivered = await post(H, JOHN, okRouter, okRec.presence);
  if (delivered.status === 200 && heardOf(okRec, JOHN).length === 1 && heardOf(okRec, JOHN)[0].url === RELAY) test.check('delivered: john heard once at the relay that carried the answer');
  else test.fail(OWED + 'after a delivered post: status ' + delivered.status + ', heard ' + JSON.stringify(okRec.heard));
  const noRec = recorder(naming);
  const refusing = { post: function () { return Promise.resolve({ ok: false, status: 404, error: 'peer not reachable', text: '' }); } };
  await post(H, JOHN, refusing, noRec.presence);
  if (heardOf(noRec, JOHN).length === 0) test.check('refused: nobody heard — present comes only from an answer that crossed the wire');
  else test.fail(OWED + 'heard after a refused post: ' + JSON.stringify(noRec.heard));
  const plain = await post(H, JOHN, okRouter, { relaysNaming: function () { return [RELAY]; }, detail: function () { return {}; } });
  if (plain.status === 200) test.check('and a presence picture without heard (the older fakes) still posts');
  else test.fail(OWED + 'a post without heard failed: ' + JSON.stringify(plain.body));

  // 4. an arrival hears its sender: server.js's noteSeen(from, relayUrl) also calls presence.heard(relayUrl, from).
  // Not mounted here (the closure lives in server.js's boot block); no vacuous green for it either. Verified live
  // at review: a line from one agent's node turns that agent green on the other's Contacts page, no restart.
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
});
