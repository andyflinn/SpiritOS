'use strict';

// spirit/test/relayListNoCall.js
// goal/G22.4: THE RELAY LIST ASKS NO RELAY, AND THE ADDRESS CHECK IS A MODULE OF ITS OWN.
//
// ANDY'S DECISIONS (goal/G22.4):
//   peerPost owns every contact with a relay; the hub never touches a relay or the relay library, it asks peerPost.
//   1. The relay list (relay.get, relay.search) is a search over the relays peerPost already knows, from its
//      streams, with no call to any relay. A relay peerPost has never met shows as not joined.
//   2. The relay address check (assertRelayUrl) moves out of relayRequest.js into a module of its own, since it
//      sends nothing; the relay library then means only traffic on the wire.
//
// WHAT IS ASSERTED
//   1. relay.search and relay.get answer with NOTHING reaching any relay: no router.relayKey, no router.post, no
//      router.claim, and no http/https request or fetch in this process while they run.
//   2. A relay with an open stream shows online; one this node owns (it holds the report a relay sends only to its
//      owner) shows "yours" with this node's key as its owner; one seated shows "member"; the relay's key is the
//      one pinned at the seat (offboard reads it as roll.relayKey).
//   3. A seated relay with no stream shows offline; a relay never met (no seat, no stream) shows "not joined".
//   4. relayRequest.js no longer exports assertRelayUrl (or isLoopbackHost); spirit/run/js/relayUrl.js does, with
//      the same rules: https anywhere, http only to loopback, anything else and a bad url refused.
//
// In process, the way relaySearchMatcher.js builds its hub: a temp root of this suite's own, with a router standing
// in for the node's peerPost that answers only what peerPost holds and counts every ask that would reach a relay.

const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G22.4: ';
const RUN_JS = path.join(__dirname, '..', 'run', 'js');
const relayKeys = require('../run/js/relayKeys.js');
const auth = require('../run/js/relayAuth.js');

const roots = [];
function freshRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relaylistnocall-'));
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  auth.saveIdentity(root, auth.generateIdentity('relaylistnocall'));
  roots.push(root);
  return root;
}

// Every way out of this process to a relay, counted while the list is asked.
const outward = [];
function watchWire() {
  const saved = { http: http.request, https: https.request, httpGet: http.get, httpsGet: https.get, fetch: global.fetch };
  http.request = function () { outward.push('http.request'); return saved.http.apply(this, arguments); };
  https.request = function () { outward.push('https.request'); return saved.https.apply(this, arguments); };
  http.get = function () { outward.push('http.get'); return saved.httpGet.apply(this, arguments); };
  https.get = function () { outward.push('https.get'); return saved.httpsGet.apply(this, arguments); };
  if (typeof saved.fetch === 'function') {
    global.fetch = function () { outward.push('fetch'); return saved.fetch.apply(this, arguments); };
  }
  return function restore() {
    http.request = saved.http; https.request = saved.https; http.get = saved.httpGet; https.get = saved.httpsGet;
    if (typeof saved.fetch === 'function') global.fetch = saved.fetch;
  };
}

const LIVE = 'http://127.0.0.1:47101';      // seated, stream open
const MINE = 'http://127.0.0.1:47102';      // seated, stream open, owned (its owner-only report is held)
const QUIET = 'http://127.0.0.1:47103';     // seated, no stream
const STRANGER = 'http://127.0.0.1:47104';  // listed, never met: no seat, no stream

function fakeRouter(asked) {
  function refuse(what) {
    return function () { asked.push(what); return Promise.reject(new Error('this suite\'s router: ' + what + ' reaches a relay')); };
  }
  return {
    relayKey: refuse('relayKey'),
    post: refuse('post'),
    claim: refuse('claim'),
    onReply: function () {},
    onRequest: function () {},
    relaysHeld: function () { return [LIVE, MINE]; },
    relayStatus: function () { const s = {}; s[MINE] = { present: 3, at: 1 }; return s; },
    relaysNaming: function () { return []; },
  };
}

test.startTest('goal/G22.4: the relay list asks no relay, and the address check is a module of its own');

const root = freshRoot();
const me = auth.loadIdentity(root);
relayKeys.list(root, LIVE, 'live', 'RELAYKEY-live');
relayKeys.seat(root, LIVE, 'me-on-live');
relayKeys.list(root, MINE, 'mine', 'RELAYKEY-mine');
relayKeys.seat(root, MINE, 'me-on-mine');
relayKeys.list(root, QUIET, 'quiet', 'RELAYKEY-quiet');
relayKeys.seat(root, QUIET, 'me-on-quiet');
relayKeys.list(root, STRANGER, 'stranger', 'RELAYKEY-stranger');

const asked = [];
const deps = { router: fakeRouter(asked) };
const hub = require('../run/js/hub.js').createHub(root);
const restore = watchWire();

function label(items, url) {
  const hit = (items || []).filter(function (i) { return i.key === url; })[0];
  // The label is the row as json since goal/G30.7; the ruled sentence is its text.
  if (!hit) return '(absent)';
  try { return JSON.parse(hit.label).text; } catch (e) { return hit.label; }
}

Promise.resolve()
  .then(function () {
    return Promise.all([
      Promise.resolve(hub.relaySearch({ q: '*', name: '' }, deps)).catch(function (e) { return { threw: String(e && e.message || e) }; }),
      Promise.all([LIVE, MINE, QUIET, STRANGER].map(function (u) {
        return Promise.resolve(hub.relayGet({ key: u }, deps)).catch(function (e) { return { threw: String(e && e.message || e) }; });
      })),
    ]);
  })
  .then(function (got) {
    // Anything the list set off later (a stray promise) has a moment to show.
    return new Promise(function (r) { setTimeout(function () { r(got); }, 200); });
  })
  .then(function (got) {
    restore();
    const search = got[0];
    const gets = got[1];

    test.subHeading('1. nothing reaches a relay');
    if (asked.length === 0) test.check('relay.search and relay.get asked peerPost nothing that reaches a relay');
    else test.fail(OWED + 'the list asked the router: ' + JSON.stringify(asked));
    if (outward.length === 0) test.check('and no http, https or fetch left this process while they ran');
    else test.fail(OWED + 'requests left this process: ' + JSON.stringify(outward));

    test.subHeading('2. a relay with an open stream: online, its key and owner as the node knows them');
    const items = search && search.items;
    const l = { live: label(items, LIVE), mine: label(items, MINE), quiet: label(items, QUIET), stranger: label(items, STRANGER) };
    if (l.live === 'live — member, online') test.check('the seated relay with a stream reads "live — member, online"');
    else test.fail(OWED + 'the seated relay with a stream reads ' + JSON.stringify(l.live));
    if (l.mine === 'mine — yours, online') test.check('the owned relay reads "mine — yours, online"');
    else test.fail(OWED + 'the owned relay reads ' + JSON.stringify(l.mine));
    const gLive = gets[0] && gets[0].relay;
    const gMine = gets[1] && gets[1].relay;
    if (gLive && gLive.status === 200 && gLive.claimed === true && gLive.owned === false &&
        gLive.roll && gLive.roll.relayKey === 'RELAYKEY-live' && gLive.roll.myLabel === 'me-on-live') {
      test.check('relay.get on it: online, claimed, the pinned relay key and this node\'s seat label');
    } else test.fail(OWED + 'relay.get on the live relay gave ' + JSON.stringify(gets[0]));
    if (gMine && gMine.owned === true && gMine.claimed === true && gMine.roll && gMine.roll.ownerKey === me.publicKey &&
        gMine.roll.relayKey === 'RELAYKEY-mine' && gets[1].report && gets[1].report.present === 3) {
      test.check('relay.get on the owned relay: owned, owner key is this node\'s, the report it holds rides along');
    } else test.fail(OWED + 'relay.get on the owned relay gave ' + JSON.stringify(gets[1]));

    test.subHeading('3. no stream is offline; never met is not joined');
    if (l.quiet === 'quiet — member, offline') test.check('the seated relay with no stream reads "quiet — member, offline"');
    else test.fail(OWED + 'the seated relay with no stream reads ' + JSON.stringify(l.quiet));
    if (l.stranger === 'stranger — not joined, offline') test.check('the relay never met reads "stranger — not joined, offline"');
    else test.fail(OWED + 'the relay never met reads ' + JSON.stringify(l.stranger));
    const gStranger = gets[3] && gets[3].relay;
    if (gStranger && gStranger.claimed === false && gStranger.owned === false && gStranger.status === 0) {
      test.check('relay.get on it: not claimed, not owned, status 0');
    } else test.fail(OWED + 'relay.get on the relay never met gave ' + JSON.stringify(gets[3]));
  })
  .then(function () {
    test.subHeading('4. assertRelayUrl lives in a module of its own');
    let wire = {};
    try { wire = require(path.join(RUN_JS, 'relayRequest.js')); } catch (e) { wire = {}; }
    if (!('assertRelayUrl' in wire) && !('isLoopbackHost' in wire)) test.check('relayRequest.js exports neither assertRelayUrl nor isLoopbackHost');
    else test.fail(OWED + 'relayRequest.js still exports ' + ['assertRelayUrl', 'isLoopbackHost'].filter(function (k) { return k in wire; }).join(', '));
    let mod = null;
    try { mod = require(path.join(RUN_JS, 'relayUrl.js')); } catch (e) { mod = null; }
    if (!mod || typeof mod.assertRelayUrl !== 'function') {
      test.fail(OWED + 'spirit/run/js/relayUrl.js does not export assertRelayUrl');
      return;
    }
    test.check('spirit/run/js/relayUrl.js exports assertRelayUrl');
    function verdict(u) { try { mod.assertRelayUrl(u); return 'ok'; } catch (e) { return String(e.message); } }
    const ok = ['https://noderoutes.net', 'https://1.2.3.4:8443/x', 'http://127.0.0.1:9', 'http://localhost:7'];
    const bad = ['http://noderoutes.net', 'http://10.0.0.1:9', 'ftp://127.0.0.1', 'not a url', ''];
    const okGot = ok.map(verdict);
    const badGot = bad.map(verdict);
    if (okGot.every(function (v) { return v === 'ok'; })) test.check('https anywhere and http to loopback are accepted');
    else test.fail(OWED + 'accepted: ' + JSON.stringify(okGot));
    if (badGot.every(function (v) { return v !== 'ok'; }) && /bad relay url/.test(badGot[3]) && /must be https/.test(badGot[0])) {
      test.check('http to a public host, another scheme and a bad url are refused, each by its own words');
    } else test.fail(OWED + 'refused: ' + JSON.stringify(badGot));
    const hubSrc = fs.readFileSync(path.join(RUN_JS, 'hub.js'), 'utf8');
    if (/require\('\.\/relayUrl'\)/.test(hubSrc) && !/wire\.assertRelayUrl/.test(hubSrc)) test.check('hub.js takes assertRelayUrl from relayUrl.js');
    else test.fail(OWED + 'hub.js still takes assertRelayUrl from relayRequest.js');
  })
  .then(function () {
    roots.forEach(function (r) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (e) { /* busy */ } });
    test.reportSuccessFailureCount();
  })
  .catch(function (err) {
    try { restore(); } catch (e) { /* restored already */ }
    test.fail('relayListNoCall threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });

module.exports = test;
