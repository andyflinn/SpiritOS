'use strict';

// spirit/test/relaySearchMatcher.js
// goal/G19.17: relay.search ranks the node's relays with probabilityStringObjectMatch, as the desk ranks its items.
//
// THE ITEM, AS FOUND: relay.search (hub.js) matched its own way, through searchBucket and gradedSearch, while the
// desk (process/js/desk/desk.js) had moved onto the probabilit* modules (goal/G18.5). A '*' never spans the '/' of a
// url, so a relay whose label is its url was left out of the answer; and a claim lists a relay with its url as the
// label (hub.js hands ownerBadge.addRelay an empty label, relayKeys.list falls back on the url), so a relay just
// claimed was missing from Natter's relay list although relay.get found it.
//
// ANDY'S DECISION: "we should have put in the new search thinggie for relay's" ; "add it."
// THE SHAPE: relay.search ranks the node's relay rows with probabilityStringObjectMatch, as the desk ranks its items,
// and returns every listed relay, whatever its label; it stays a bucket-bounded search with its partial flag.
//
// WHAT IS ASSERTED
//   1. A relay labelled by its url is listed, by '*' and by ''.
//   2. A relay listed by a claim (ownerBadge.addRelay with the claim's empty label) appears.
//   3. A query ranks: the best match first, a typo still finds it, and nothing listed is filtered out.
//   4. The byte cap holds and `more` says when something was cut.
//   5. An empty query lists every relay, in the node's list order.
//   6. The answer keeps its shape {ok, items:[{key,label}], more, mustPick, name}.
//   7. hub.js ranks with probabilityStringObjectMatch and probabilityBucket, and relay.search no longer uses searchBucket.
//
// The relays are unreachable loopback ports, so each makes an offline row without any relay having to be up.
// Temp roots of this suite's own.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G19.17: ';
const HUB = path.join(__dirname, '..', 'run', 'js', 'hub.js');
const relayKeys = require('../run/js/relayKeys.js');
const ownerBadge = require('../run/js/ownerBadge.js');
const limits = require('../run/js/limits.js');

const roots = [];
function freshRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relaysearchmatcher-'));
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  // Since goal/G22.5: a node's root always holds its identity, and the relay probe is asked with its key.
  const auth = require('../run/js/relayAuth.js');
  auth.saveIdentity(root, auth.generateIdentity('relaysearchmatcher'));
  roots.push(root);
  return root;
}
function hubOf(root) { return require('../run/js/hub.js').createHub(root); }
function keysOf(r) { return ((r && r.items) || []).map(function (i) { return i.key; }); }

test.startTest('relay.search ranks the node\'s relays with probabilityStringObjectMatch (goal/G19.17)');

Promise.resolve()
  .then(function () {
    test.subHeading('1. A relay labelled by its url is listed');
    const root = freshRoot();
    relayKeys.list(root, 'http://127.0.0.1:9', 'http://127.0.0.1:9', 'RELAYKEY-url');
    const hub = hubOf(root);
    return Promise.all(['*', ''].map(function (q) { return hub.relaySearch({ q: q, name: '' }); })).then(function (rs) {
      const k = rs.map(keysOf);
      if (k.every(function (x) { return x.length === 1 && x[0] === 'http://127.0.0.1:9'; })) {
        test.check("'*' and '' each list the relay whose label is its url");
      } else test.fail(OWED + "a relay labelled by its url is left out: '*' gave " + JSON.stringify(k[0]) + ", '' gave " + JSON.stringify(k[1]));
    });
  })
  .then(function () {
    test.subHeading('2. A relay listed by a claim appears');
    const root = freshRoot();
    relayKeys.list(root, 'http://127.0.0.1:7', 'lab', 'RELAYKEY-lab');
    // The claim's own call (hub.js, after a claim succeeds): an empty label, so the url stands in for it.
    ownerBadge.addRelay(root, 'http://127.0.0.1:9', '', 'RELAYKEY-claimed');
    const hub = hubOf(root);
    return hub.relaySearch({ q: '*', name: '' }).then(function (r) {
      const k = keysOf(r);
      if (k.indexOf('http://127.0.0.1:9') !== -1 && k.indexOf('http://127.0.0.1:7') !== -1) {
        test.check('the relay just claimed is in the answer beside the one already listed');
      } else test.fail(OWED + 'the claimed relay is missing from relay.search: ' + JSON.stringify(k));
    });
  })
  .then(function () {
    test.subHeading('3. A query ranks: best first, a typo still finds it, nothing filtered out');
    const root = freshRoot();
    relayKeys.list(root, 'http://127.0.0.1:1', 'alpha', 'RELAYKEY-a');
    relayKeys.list(root, 'http://127.0.0.1:7', 'natter lab', 'RELAYKEY-n');
    relayKeys.list(root, 'http://127.0.0.1:9', 'zulu', 'RELAYKEY-z');
    const hub = hubOf(root);
    // probabilityStringMatch grades one mistyped word that is no part of a label 0 against every label, so a query of
    // that one word ranks nothing; a typo in one word of two still ranks by the word that is right. Either way the
    // relay is in the answer: ranked, never filtered.
    return Promise.all(['natter lab', 'natter lbb', 'zulu', 'natterlbb'].map(function (q) { return hub.relaySearch({ q: q, name: '' }); })).then(function (rs) {
      const k = rs.map(keysOf);
      if (k[0][0] === 'http://127.0.0.1:7' && k[2][0] === 'http://127.0.0.1:9') {
        test.check("'natter lab' puts natter lab first and 'zulu' puts zulu first");
      } else test.fail(OWED + 'the best match is not first: ' + JSON.stringify(k));
      if (k[1][0] === 'http://127.0.0.1:7') test.check("the typo 'natter lbb' still finds natter lab first");
      else test.fail(OWED + "the typo 'natter lbb' does not rank natter lab first: " + JSON.stringify(k[1]));
      if (k[3].indexOf('http://127.0.0.1:7') !== -1) test.check("the typo 'natterlbb', graded 0 everywhere, still has natter lab in the answer");
      else test.fail(OWED + "the typo 'natterlbb' lost natter lab: " + JSON.stringify(k[3]));
      if (k.every(function (x) { return x.length === 3; })) test.check('every listed relay is in each answer: ranked, not filtered');
      else test.fail(OWED + 'a query filtered relays out: ' + JSON.stringify(k));
    });
  })
  .then(function () {
    test.subHeading('4. The byte cap holds and `more` says what was cut');
    const root = freshRoot();
    const long = new Array(7001).join('x');
    relayKeys.list(root, 'http://127.0.0.1:1', 'a' + long, 'RELAYKEY-1');
    relayKeys.list(root, 'http://127.0.0.1:7', 'b' + long, 'RELAYKEY-7');
    relayKeys.list(root, 'http://127.0.0.1:9', 'c' + long, 'RELAYKEY-9');
    const hub = hubOf(root);
    return hub.relaySearch({ q: '', name: '' }).then(function (r) {
      const bytes = Buffer.byteLength(JSON.stringify({ items: r.items, more: r.more }), 'utf8');
      if (r.items.length > 0 && r.items.length < 3 && r.more === true && bytes <= limits.PLAINTEXT_MAX) {
        test.check('three labels of 7000 bytes: ' + r.items.length + ' sent, more set, ' + bytes + ' bytes within ' + limits.PLAINTEXT_MAX);
      } else test.fail(OWED + 'the cap or the partial flag: ' + r.items.length + ' items, more ' + r.more + ', ' + bytes + ' bytes');
      return hubOf(freshRoot()).relaySearch({ q: '', name: '' });
    }).then(function (r) {
      // A fresh root lists nothing (no boot seeds it here): nothing left out, so `more` stays false.
      if (r.more === false) test.check('an answer that left nothing out says more: false');
      else test.fail(OWED + 'more set on an answer that left nothing out');
    });
  })
  .then(function () {
    test.subHeading('5. An empty query lists every relay, in the node\'s list order');
    const root = freshRoot();
    relayKeys.list(root, 'http://127.0.0.1:9', 'zulu', 'RELAYKEY-z');
    relayKeys.list(root, 'http://127.0.0.1:1', 'http://127.0.0.1:1', 'RELAYKEY-a');
    relayKeys.list(root, 'http://127.0.0.1:7', 'mid', 'RELAYKEY-m');
    const hub = hubOf(root);
    return Promise.all(['', '*'].map(function (q) { return hub.relaySearch({ q: q, name: '' }); })).then(function (rs) {
      const want = JSON.stringify(['http://127.0.0.1:9', 'http://127.0.0.1:1', 'http://127.0.0.1:7']);
      const k = rs.map(keysOf);
      if (JSON.stringify(k[0]) === want && JSON.stringify(k[1]) === want) test.check("'' and '*' list all three in list order");
      else test.fail(OWED + "'' gave " + JSON.stringify(k[0]) + ", '*' gave " + JSON.stringify(k[1]) + ', wanted ' + want);
    });
  })
  .then(function () {
    test.subHeading('6. The answer keeps its shape');
    const root = freshRoot();
    relayKeys.list(root, 'http://127.0.0.1:9', 'probe', 'RELAYKEY-p');
    return hubOf(root).relaySearch({ q: 'probe', name: 'andy' }).then(function (r) {
      const keys = Object.keys(r).sort().join(',');
      const item = r.items[0] || {};
      if (r.ok === true && keys === 'items,more,mustPick,name,ok,status' && r.name === 'andy' && typeof r.mustPick === 'boolean' &&
          Object.keys(item).sort().join(',') === 'key,label' && /^probe — not joined, offline$/.test(item.label)) {
        test.check('{ok, status, items:[{key,label}], more, mustPick, name}, the label as ruled');
      } else test.fail('the answer changed shape: ' + JSON.stringify(r));
    });
  })
  .then(function () {
    test.subHeading('7. hub.js ranks with the probabilit* modules, not searchBucket');
    const src = fs.readFileSync(HUB, 'utf8');
    const start = src.indexOf('function relaySearch(');
    const rest = start === -1 ? '' : src.slice(start);
    const end = rest.search(/\r?\n  \}\r?\n/);
    const body = end === -1 ? rest : rest.slice(0, end);
    if (/probabilityStringObjectMatch\(/.test(body) && /seatFor\(/.test(body)) test.check('relaySearch weighs each row with probabilityStringObjectMatch and seats it in a probabilityBucket');
    else test.fail(OWED + 'relaySearch does not rank with probabilityStringObjectMatch and probabilityBucket');
    if (!/searchBucket/.test(body)) test.check('relaySearch no longer goes through searchBucket');
    else test.fail(OWED + 'relaySearch still matches through searchBucket');
  })
  .then(function () {
    roots.forEach(function (r) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (e) { /* busy */ } });
    test.reportSuccessFailureCount();
  })
  .catch(function (err) {
    test.fail('relaySearchMatcher threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });

module.exports = test;
