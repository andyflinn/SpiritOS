'use strict';

// HIS RELAYS, LISTED: contact.search over the one table and relay.get, and the relay family's status that puts them
// back into the shape his screens draw.
//
//   Andy, 2026-09-27: "the verb changes changing list fetches to a
//   search(labe) and geKey(key) pair are approved", and "go." on the label:
//   "key = the relay's url, label = its name plus what's true of it, e.g.
//   'spirit-3 — yours, online', 'lab — member, offline'".
//
// SINCE goal/G40.11 relay.search is gone (Andy: "yes. those names." to contact.search covering relays too): a relay is
// a row of the one table, contact.search {relay: 'yes', keep: 'yes'} lists the relays this node keeps, keyed by ID with
// the url on the label, and relay.get answers one by its ID or its url. relay.status (spirit/relay/api.js, the relay
// family's names) asks the search on the one spirit object, gets each relay, and hands the screens their old shape.
// The screens' own suites fake that helper, so the assembly itself is proven here, against the real api.js.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const API = path.join(__dirname, '..', 'run', 'spirit', 'relay', 'api.js');

// The node, faked at both doors: what contact.search (on the one spirit object) and relay.get (the family's call)
// answer.
function relayStatus(rows, reports, opts) {
  const o = opts || {};
  const asked = [];
  global.spirit = {
    contact: {
      search: function (args) {
        asked.push({ verb: 'contact.search', args: args });
        if (o.searchFails) return Promise.reject(Object.assign(new Error('probe failed'), { status: 502, body: { ok: false, error: 'probe failed' } }));
        return Promise.resolve({ ok: true, more: !!o.more,
          items: rows.map(function (r) { return { key: r.key, label: JSON.stringify({ name: r.label, relay: true, keep: true, url: r.url }) }; }) });
      },
    },
  };
  function call(verb, args) {
    asked.push({ verb: 'relay.' + verb, args: args });
    if (verb !== 'get') return Promise.reject(new Error('no such verb: ' + verb));
    const row = rows.filter(function (r) { return r.key === args.key; })[0];
    if (!row) return Promise.reject(Object.assign(new Error('no such relay'), { status: 404 }));
    return Promise.resolve({ ok: true, key: row.url, relay: row, report: reports[row.url] || null });
  }
  delete require.cache[require.resolve(API)];
  const names = require(API).names(call);
  return { status: names.status, asked: asked };
}

test.startTest('relay.status over contact.search and relay.get, as the relay family reassembles them');

const ROWS = [
  { key: 'KEY-A', url: 'https://a.example', label: 'spirit-3', status: 200, owned: true, claimed: true },
  { key: 'KEY-B', url: 'https://b.example', label: 'lab', status: 0, owned: false, claimed: true },
  { key: 'KEY-C', url: 'https://c.example', label: 'far', status: 200, owned: false, claimed: false },
];

(function reassembles() {
  test.subHeading('One search and one get per relay make the answer the screens were written against');
  const k = relayStatus(ROWS, { 'https://a.example': { members: 3 } });
  return k.status('andy').then(function (r) {
    const b = r && r.body;
    if (r.status === 200 && b && b.rows.length === 3 && b.rows[0].url === 'https://a.example' && b.rows[1].status === 0) {
      test.check('rows: every relay whole, in the order the search answered');
    } else {
      test.fail('rows: ' + JSON.stringify(b));
    }
    if (JSON.stringify(b.ownedUrls) === '["https://a.example"]' &&
        JSON.stringify(b.claimedUrls) === '["https://a.example","https://b.example"]' && b.mustPick === false) {
      test.check('ownedUrls, claimedUrls and mustPick (more than one owned) come out as relay.status gave them');
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
    const search = k.asked.filter(function (a) { return a.verb === 'contact.search'; });
    const gets = k.asked.filter(function (a) { return a.verb === 'relay.get'; });
    if (search.length === 1 && search[0].args.relay === 'yes' && search[0].args.keep === 'yes' &&
        gets.length === 3 && gets[0].args.key === 'KEY-A' && !k.asked.some(function (a) { return a.verb === 'relay.search'; })) {
      test.check('it asks contact.search once for the kept relays and relay.get per relay by its ID, and never relay.search');
    } else {
      test.fail('asked: ' + JSON.stringify(k.asked));
    }
  });
}())
  .then(function () {
    test.subHeading('Two relays owned is a choice to make: mustPick');
    const two = ROWS.map(function (r) { return Object.assign({}, r, { owned: r.key !== 'KEY-C' }); });
    return relayStatus(two, {}).status('').then(function (r) {
      if (r.body && r.body.mustPick === true) test.check('owning two relays says mustPick');
      else test.fail('mustPick with two owned: ' + JSON.stringify(r.body && r.body.mustPick));
    });
  })
  .then(function () {
    test.subHeading('A search the node could not answer is handed back, not drawn as no relays');
    return relayStatus(ROWS, {}, { searchFails: true }).status('').then(function (r) {
      if (r.status === 502 && r.body && r.body.error === 'probe failed') test.check('the failure is passed on as it came');
      else test.fail('a failed search gave ' + JSON.stringify(r));
    });
  })
  .then(function () {
    test.subHeading('The node side: relay.get still carries the state as words');
    const hub = fs.readFileSync(path.join(__dirname, '..', 'run', 'spirit', 'hub.js'), 'utf8');
    const relayApi = require(API);
    if (!/function relaySearch\(/.test(hub) && !/relaySearch:/.test(hub) && !('search' in relayApi.verbs)) {
      test.check('relay.search is gone from the node and from the relay family');
    } else {
      test.fail('relay.search is still there');
    }
  })
  .then(function () {
    // THE REAL SEARCH, NOT THE FAKE ONE. Every check above fakes the node's answer, so they could stay green while
    // the real one answered nothing (Andy saw it as "natter doesn't recognize my relay as alive anymore", slim/G1.3,
    // 2026-09-29). An unreachable relay still makes a row (offline), so no relay has to be up for this.
    test.subHeading("contact.search {relay: 'yes'} with '*', '' and a word finds his relay (the node's real search)");
    const os = require('os');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-relaysearch-'));
    fs.mkdirSync(path.join(root, 'shell', 'natter'), { recursive: true });
    fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
    // Since goal/G22.5: a node's root always holds its identity.
    const auth = require('../run/spirit/relayAuth.js');
    auth.saveIdentity(root, auth.generateIdentity('relaysearch'));
    // Since goal/G40.11 a listed relay is a kept row of the one table, flagged relay, keyed by its ID.
    require('../run/spirit/relayKeys.js').list(root, 'http://127.0.0.1:9', 'probe', 'RELAYKEY-probe');
    const hub = require('../run/spirit/hub.js').createHub(root);
    const rs = ['*', '', 'probe'].map(function (q) { return hub.contactSearch({ q: q, relay: 'yes' }); });
    const found = rs.map(function (r) {
      return ((r && r.items) || []).map(function (i) { let l = {}; try { l = JSON.parse(i.label); } catch (e) { l = {}; } return i.key + '@' + l.url; });
    });
    if (found.every(function (k) { return k.length === 1 && k[0] === 'RELAYKEY-probe@http://127.0.0.1:9'; })) {
      test.check("'*', '' and 'probe' each find the one relay, by its ID, with http://127.0.0.1:9 on its label");
    } else test.fail("OWED by slim/G1.3 (Andy's relay display): '*' found " + JSON.stringify(found[0]) + ", '' found " + JSON.stringify(found[1]) + ", 'probe' found " + JSON.stringify(found[2]));
    return hub.relayGet({ key: 'RELAYKEY-probe' }, {}).then(function (g) {
      if (g && g.ok && g.relay && g.relay.url === 'http://127.0.0.1:9' && g.key === 'http://127.0.0.1:9') test.check('and relay.get answers it by its ID as by its url');
      else test.fail('relay.get by ID: ' + JSON.stringify(g));
      try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* busy */ }
    });
  })
  .then(function () { test.reportSuccessFailureCount(); })
  .catch(function (err) {
    test.fail('relaySearch threw: ' + ((err && err.stack) || err));
    test.reportSuccessFailureCount();
  });

module.exports = test;
