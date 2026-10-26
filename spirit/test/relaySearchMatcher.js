'use strict';

// spirit/test/relaySearchMatcher.js
// goal/G19.17, carried into goal/G40.11: the node's relays are ranked with probabilityStringObjectMatch, as the desk
// ranks its items.
//
// THE ITEM, AS FOUND (goal/G19.17): relay.search matched its own way, and a '*' never spanned the '/' of a url, so a
// relay whose label is its url was left out; a claim lists a relay with its url as the label, so a relay just claimed
// was missing from Natter's list although relay.get found it. ANDY'S DECISION: "we should have put in the new search
// thinggie for relay's" ; "add it."
//
// SINCE goal/G40.11 relay.search is gone (Andy: "yes. those names."): contact.search covers the relays, one row each of
// the one table, keyed by ID with the url on the label, and {relay: 'yes'} asks for them alone. It ranks as it always
// did: words graded by probabilityStringObjectMatch over the names and the url, best first, a row that grades 0 left
// out; no words is every row.
//
// WHAT IS ASSERTED
//   1. A relay labelled by its url is listed, by '*' and by ''.
//   2. A relay listed by a claim (ownerBadge.addRelay with the claim's empty label) appears.
//   3. A query ranks: the best match first, a typo in one word of two still finds it.
//   4. The byte cap holds and `more` says when something was cut.
//   5. An empty query lists every relay.
//   6. The answer keeps its shape {ok, status, items:[{key,label}], more}, the label a json row with relay and url.
//   7. hub.js ranks with probabilityStringObjectMatch and probabilityBucket, and relay.search is gone.
//
// The relays are unreachable loopback ports, so each makes a row without any relay having to be up.
// Temp roots of this suite's own.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G19.17: ';
const HUB = path.join(__dirname, '..', 'run', 'spirit', 'hub.js');
const relayKeys = require('../run/spirit/relayKeys.js');
const ownerBadge = require('../run/spirit/ownerBadge.js');
const limits = require('../run/spirit/limits.js');

const roots = [];
function freshRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relaysearchmatcher-'));
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  // Since goal/G22.5: a node's root always holds its identity, and the relay probe is asked with its key.
  const auth = require('../run/spirit/relayAuth.js');
  auth.saveIdentity(root, auth.generateIdentity('relaysearchmatcher'));
  roots.push(root);
  return root;
}
function hubOf(root) { return require('../run/spirit/hub.js').createHub(root); }
function keysOf(r) { return ((r && r.items) || []).map(function (i) { return i.key; }); }
// The relays, by contact.search: synchronous on the node, answered as a promise so the chain reads as it did.
function relays(hub, q) { return Promise.resolve(hub.contactSearch({ q: q, relay: 'yes' })); }

test.startTest('contact.search ranks the node\'s relays with probabilityStringObjectMatch (goal/G19.17, goal/G40.11)');

Promise.resolve()
  .then(function () {
    test.subHeading('1. A relay labelled by its url is listed');
    const root = freshRoot();
    relayKeys.list(root, 'http://127.0.0.1:9', 'http://127.0.0.1:9', 'RELAYKEY-url');
    const hub = hubOf(root);
    return Promise.all(['*', ''].map(function (q) { return relays(hub, q); })).then(function (rs) {
      const k = rs.map(keysOf);
      if (k.every(function (x) { return x.length === 1 && x[0] === 'RELAYKEY-url'; })) {
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
    return relays(hub, '*').then(function (r) {
      const k = keysOf(r);
      if (k.indexOf('RELAYKEY-claimed') !== -1 && k.indexOf('RELAYKEY-lab') !== -1) {
        test.check('the relay just claimed is in the answer beside the one already listed');
      } else test.fail(OWED + 'the claimed relay is missing from relay.search: ' + JSON.stringify(k));
    });
  })
  .then(function () {
    test.subHeading('3. A query ranks: best first, and a typo in one word of two still finds it');
    const root = freshRoot();
    relayKeys.list(root, 'http://127.0.0.1:1', 'alpha', 'RELAYKEY-a');
    relayKeys.list(root, 'http://127.0.0.1:7', 'natter lab', 'RELAYKEY-n');
    relayKeys.list(root, 'http://127.0.0.1:9', 'zulu', 'RELAYKEY-z');
    const hub = hubOf(root);
    // contact.search ranks as it always did: a typo in one word of two still ranks by the word that is right, and a
    // row every word grades 0 against is not in the answer.
    return Promise.all(['natter lab', 'natter lbb', 'zulu'].map(function (q) { return relays(hub, q); })).then(function (rs) {
      const k = rs.map(keysOf);
      if (k[0][0] === 'RELAYKEY-n' && k[2][0] === 'RELAYKEY-z') {
        test.check("'natter lab' puts natter lab first and 'zulu' puts zulu first");
      } else test.fail(OWED + 'the best match is not first: ' + JSON.stringify(k));
      if (k[1][0] === 'RELAYKEY-n') test.check("the typo 'natter lbb' still finds natter lab first");
      else test.fail(OWED + "the typo 'natter lbb' does not rank natter lab first: " + JSON.stringify(k[1]));
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
    return relays(hub, '').then(function (r) {
      const bytes = Buffer.byteLength(JSON.stringify({ items: r.items, more: r.more }), 'utf8');
      if (r.items.length > 0 && r.items.length < 3 && r.more === true && bytes <= limits.PLAINTEXT_MAX) {
        test.check('three labels of 7000 bytes: ' + r.items.length + ' sent, more set, ' + bytes + ' bytes within ' + limits.PLAINTEXT_MAX);
      } else test.fail(OWED + 'the cap or the partial flag: ' + r.items.length + ' items, more ' + r.more + ', ' + bytes + ' bytes');
      return relays(hubOf(freshRoot()), '');
    }).then(function (r) {
      // A fresh root lists nothing (no boot seeds it here): nothing left out, so `more` stays false.
      if (r.more === false) test.check('an answer that left nothing out says more: false');
      else test.fail(OWED + 'more set on an answer that left nothing out');
    });
  })
  .then(function () {
    test.subHeading('5. An empty query lists every relay');
    const root = freshRoot();
    relayKeys.list(root, 'http://127.0.0.1:9', 'zulu', 'RELAYKEY-z');
    relayKeys.list(root, 'http://127.0.0.1:1', 'http://127.0.0.1:1', 'RELAYKEY-a');
    relayKeys.list(root, 'http://127.0.0.1:7', 'mid', 'RELAYKEY-m');
    const hub = hubOf(root);
    return Promise.all(['', '*'].map(function (q) { return relays(hub, q); })).then(function (rs) {
      // In the list's own order, by name (hub.buildPeople), the same for both.
      const want = JSON.stringify(['RELAYKEY-a', 'RELAYKEY-m', 'RELAYKEY-z']);
      const k = rs.map(function (r) { return keysOf(r).slice().sort(); });
      if (JSON.stringify(k[0]) === want && JSON.stringify(k[1]) === want && JSON.stringify(keysOf(rs[0])) === JSON.stringify(keysOf(rs[1]))) test.check("'' and '*' list all three, in the same order");
      else test.fail(OWED + "'' gave " + JSON.stringify(k[0]) + ", '*' gave " + JSON.stringify(k[1]) + ', wanted ' + want);
    });
  })
  .then(function () {
    test.subHeading('6. The answer keeps its shape');
    const root = freshRoot();
    relayKeys.list(root, 'http://127.0.0.1:9', 'probe', 'RELAYKEY-p');
    return relays(hubOf(root), 'probe').then(function (r) {
      const keys = Object.keys(r).sort().join(',');
      const item = r.items[0] || {};
      const row = (function () { try { return JSON.parse(item.label); } catch (e) { return {}; } }());
      if (r.ok === true && keys === 'items,more,ok,status' && Object.keys(item).sort().join(',') === 'key,label' &&
          item.key === 'RELAYKEY-p' && row.relay === true && row.keep === true && row.url === 'http://127.0.0.1:9' && row.name === 'probe') {
        test.check('{ok, status, items:[{key,label}], more}, the key the relay\'s ID, the label a json row: its name, relay, keep and url');
      } else test.fail('the answer changed shape: ' + JSON.stringify(r));
    });
  })
  .then(function () {
    test.subHeading('7. hub.js ranks with the probabilit* modules, not searchBucket, and relay.search is gone');
    const src = fs.readFileSync(HUB, 'utf8');
    if (src.indexOf('function relaySearch(') === -1) test.check('relaySearch is gone from hub.js');
    else test.fail('relaySearch is still in hub.js');
    const start = src.indexOf('function searchPeople(');
    const rest = start === -1 ? '' : src.slice(start);
    const end = rest.search(/\r?\n  \}\r?\n/);
    const body = end === -1 ? rest : rest.slice(0, end);
    if (/probabilityStringObjectMatch\(/.test(body) && /seatFor\(/.test(body)) test.check('searchPeople weighs each row with probabilityStringObjectMatch and seats it in a probabilityBucket');
    else test.fail(OWED + 'searchPeople does not rank with probabilityStringObjectMatch and probabilityBucket');
    if (!/searchBucket/.test(body)) test.check('searchPeople does not go through searchBucket');
    else test.fail(OWED + 'searchPeople matches through searchBucket');
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
