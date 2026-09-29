'use strict';

// HIS RELAYS, SEARCHED: relay.search and relay.get, and the page kernel's
// relays.status that puts them back into the shape his screens draw.
//
//   Andy, 2026-09-27: "the verb changes changing list fetches to a
//   search(labe) and geKey(key) pair are approved", and "go." on the label:
//   "key = the relay's url, label = its name plus what's true of it, e.g.
//   'spirit-3 — yours, online', 'lab — member, offline'".
//
// relay.status answered every relay whole, and five screens were written
// against that answer. The node now answers pairs and one relay at a time;
// the page kernel (kernel.js, spirit.core.relays.status) asks the search
// with '*', gets each relay, and hands the screens their old shape. The
// screens' own suites fake that helper (testSupport.browserRelays), so the
// assembly itself is proven here, against the real kernel.js, run in a
// context with no `process` so it takes its browser half.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('./testSupport.js');

const KERNEL = path.join(__dirname, '..', 'run', 'js', 'kernel.js');

// The node, faked at the one door: what relay.search and relay.get answer.
function browserKernel(rows, reports, opts) {
  const o = opts || {};
  const asked = [];
  function answer(payload) {
    asked.push(payload.verb);
    if (payload.verb === 'relay.search') {
      if (o.searchFails) return { status: 502, body: { error: 'probe failed' } };
      return { status: 200, body: {
        ok: true, name: payload.name, mustPick: !!o.mustPick, more: !!o.more,
        items: rows.map(function (r) { return { key: r.url, label: (r.label || r.url) + ' — ' + (r.owned ? 'yours' : 'member') }; }),
      } };
    }
    if (payload.verb === 'relay.get') {
      const row = rows.filter(function (r) { return r.url === payload.key; })[0];
      if (!row) return { status: 404, body: { ok: false, error: 'no such relay' } };
      return { status: 200, body: { ok: true, key: row.url, relay: row, report: reports[row.url] || null } };
    }
    return { status: 400, body: { error: 'no such verb: ' + payload.verb } };
  }
  const fakeFetch = function (url, init) {
    const got = answer(JSON.parse(init.body));
    const text = JSON.stringify(got.body);
    return Promise.resolve({ status: got.status, text: function () { return Promise.resolve(text); } });
  };
  const win = {};
  const context = {
    window: win, fetch: fakeFetch, console: console,
    document: { addEventListener: function () {}, getElementById: function () { return null; } },
    XMLHttpRequest: function () {},
    EventSource: function () { this.addEventListener = function () {}; this.close = function () {}; },
    setTimeout: setTimeout, clearTimeout: clearTimeout, Promise: Promise,
  };
  vm.runInNewContext(fs.readFileSync(KERNEL, 'utf8'), context);
  return { spirit: win.spirit, asked: asked };
}

test.startTest('relay.search and relay.get, and the page kernel that reassembles them');

const ROWS = [
  { url: 'https://a.example', label: 'spirit-3', status: 200, owned: true, claimed: true },
  { url: 'https://b.example', label: 'lab', status: 0, owned: false, claimed: true },
  { url: 'https://c.example', label: 'far', status: 200, owned: false, claimed: false },
];

(function reassembles() {
  test.subHeading('One search and one get per relay make the answer the screens were written against');
  const k = browserKernel(ROWS, { 'https://a.example': { members: 3 } }, { mustPick: true });
  if (!k.spirit || !k.spirit.core || !k.spirit.core.relays) { test.fail('the browser half of kernel.js has no core.relays'); return Promise.resolve(); }
  return k.spirit.core.relays.status('andy').then(function (r) {
    const b = r && r.body;
    if (r.status === 200 && b && b.rows.length === 3 && b.rows[0].url === 'https://a.example' && b.rows[1].status === 0) {
      test.check('rows: every relay whole, in the order the search answered');
    } else {
      test.fail('rows: ' + JSON.stringify(b));
    }
    if (JSON.stringify(b.ownedUrls) === '["https://a.example"]' &&
        JSON.stringify(b.claimedUrls) === '["https://a.example","https://b.example"]' && b.mustPick === true) {
      test.check('ownedUrls, claimedUrls and mustPick come out as relay.status gave them');
    } else {
      test.fail('derived: ' + JSON.stringify({ o: b.ownedUrls, c: b.claimedUrls, m: b.mustPick }));
    }
    if (b.relayStatus['https://a.example'] && b.relayStatus['https://a.example'].members === 3 &&
        !('https://b.example' in b.relayStatus)) {
      test.check('relayStatus holds each report relay.get carried, and nothing for a relay with none');
    } else {
      test.fail('relayStatus: ' + JSON.stringify(b.relayStatus));
    }
    if (JSON.parse(r.text).rows.length === 3 && b.name === 'andy') {
      test.check('it answers as spirit.core.ask does, text included, with the name passed through');
    } else {
      test.fail('shape: ' + String(r.text).slice(0, 120));
    }
    const gets = k.asked.filter(function (v) { return v === 'relay.get'; }).length;
    if (k.asked[0] === 'relay.search' && gets === 3 && k.asked.indexOf('relay.status') === -1) {
      test.check('it asks relay.search once and relay.get per relay, and never the verb that is gone');
    } else {
      test.fail('asked: ' + JSON.stringify(k.asked));
    }
  });
}())
  .then(function () {
    test.subHeading('A search the node could not answer is handed back, not drawn as no relays');
    const k = browserKernel(ROWS, {}, { searchFails: true });
    return k.spirit.core.relays.status('').then(function (r) {
      if (r.status === 502 && r.body && r.body.error === 'probe failed') test.check('the failure is passed on as it came');
      else test.fail('a failed search gave ' + JSON.stringify(r));
    });
  })
  .then(function () {
    test.subHeading('The node side: labels carry the state as words');
    const hub = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'hub.js'), 'utf8');
    if (/' — ' \+ who \+ ', ' \+ up/.test(hub) && /'yours' : \(row\.claimed \? 'member' : 'not joined'\)/.test(hub)) {
      test.check('relay.search labels a relay "<name> — yours|member|not joined, online|offline"');
    } else {
      test.fail('relayLabel no longer builds the ruled label');
    }
  })
  .then(function () {
    // THE REAL SEARCH, NOT THE FAKE ONE. The page kernel asks relay.search
    // with '*'; every suite above fakes the node's answer, so they stayed
    // green while the real one answered nothing: it matched label + ' ' +
    // url, and a single '*' never spans the '/' a url holds (gradedSearch).
    // Andy saw it as "natter doesn't recognize my relay as alive anymore"
    // (slim/G1.3, 2026-09-29). An unreachable relay still makes a row
    // (offline), so no relay has to be up for this.
    test.subHeading("relay.search {q: '*'} and {q: ''} find his relays (the node's real search)");
    const os = require('os');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relaysearch-'));
    fs.mkdirSync(path.join(root, 'shell', 'natter'), { recursive: true });
    fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
    fs.writeFileSync(path.join(root, 'shell', 'natter', 'relays.json'), JSON.stringify([{ label: 'probe', url: 'http://127.0.0.1:9' }]));
    const hub = require('../run/js/hub.js').createHub(root);
    return Promise.all(['*', '', 'probe'].map(function (q) { return hub.relaySearch({ q: q, name: '' }); })).then(function (rs) {
      const keys = rs.map(function (r) { return ((r && r.items) || []).map(function (i) { return i.key; }); });
      if (keys.every(function (k) { return k.length === 1 && k[0] === 'http://127.0.0.1:9'; })) {
        test.check("'*', '' and 'probe' each find the one relay, http://127.0.0.1:9");
      } else test.fail("OWED by slim/G1.3 (Andy's relay display): '*' found " + JSON.stringify(keys[0]) + ", '' found " + JSON.stringify(keys[1]) + ", 'probe' found " + JSON.stringify(keys[2]));
      try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* busy */ }
    });
  })
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('relaySearch threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });

module.exports = test;
