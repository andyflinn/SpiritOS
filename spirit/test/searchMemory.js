'use strict';

// spirit/test/searchMemory.js
// A SEARCH ASKS MEMORY TOO, BESIDE EVERY BOUND RELAY (R39, 0021). Since goal/G40.11 the memory it asks is the one
// table's listed rows: the kept, the owned and the held; a stranger the network finds is held, one the shadow only
// heard of is not listed.
//
//   Andy: "thing is. if the userbox is offline, search can revert to
//   memory....." — "in fact if search fans out to all bound relays first,
//   why not to the memory also?" — "the relays result will take precedence
//   until timeout()" — "When the wait times out, memory fills in the
//   people no relay answered for, filtered exactly and prioritized exactly
//   like search results." — "chosen ones should always be included."
//
// The relay is a fake router answering the signed search; everything the
// node does with the answer, and with its memory, is the real code.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/spirit/relayAuth');
const relayKeys = require('../run/spirit/relayKeys');
const contactBook = require('../run/spirit/contacts');
// goal/G29.22: the old graded search is gone; the peer search's slots live in peerRank.
const peerRank = require('../run/spirit/peerRank');
const hubModule = require('../run/spirit/hub');

const RELAY = 'http://relay-a.example';
const SLOTS = peerRank.SLOTS;
// goal/G29.17: the search answers the shared shape {items: [{key, label}]}, each label the row as JSON; the key is the
// public key (goal/G30.19: contact.search's label does not repeat it).
function rowsOf(body) { return keyed(body); }

function makeHome() {
  const H = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-searchmem-'));
  auth.saveIdentity(H, auth.generateIdentity('me'));
  // Since goal/G19.15 the node's relay list is node.db's relays table, keyed by relay key.
  relayKeys.list(H, RELAY, 'A', 'RELAYKEY-A');
  return H;
}

// A relay that answers a search with the rows it is given, or never does.
function relayAnswering(rows) {
  return {
    post: function () {
      if (rows === null) return Promise.reject(new Error('no answer within the wait'));
      return Promise.resolve({
        text: JSON.stringify({ v: 1, body: { ok: true, matches: rows, more: false } }),
      });
    },
  };
}

// SINCE goal/G30.19 THE SEARCH IS contact.search, IN TWO TIERS: memory (the book and the shadow) answers at once, and the
// relays' rows follow as the peer-search job's updates, noted in the shadow. So "the relays lead, memory fills in"
// became "memory answers now, the relays' rows follow and are remembered". settle waits for the walk.
function settle() { return new Promise(function (r) { setTimeout(r, 30); }); }
function search(H, q, router) {
  const net = [];
  const jobs = {
    createJob: function (kind, type) { return { id: 'job_1', type: type, data: {} }; },
    updateJob: function (id, patch) { if (patch && patch.data && patch.data.item) net.push(patch.data.item); return null; },
  };
  let body = null;
  try { body = hubModule.createHub(H).contactSearch({ q: q }, { jobs: jobs, router: router }); }
  catch (e) { body = { status: 500, error: e.message }; }
  return settle().then(function () { return { status: body.status, body: body, net: net }; });
}
function keyed(body) { return ((body && body.items) || []).map(function (i) { let r = {}; try { r = JSON.parse(i.label); } catch (e) { r = {}; } r.publicKey = i.key; return r; }); }

function byKey(list, key) {
  return (list || []).filter(function (r) { return r.publicKey === key; })[0] || null;
}

test.startTest('A search asks memory too, beside every bound relay');

async function run() {
  const H = makeHome();
  const S = hubModule.shadow(H);

  // What this node remembers.
  S.note('K-MEM', { at: 'RK-B', url: 'http://relay-b.example', label: 'bella remembered', present: true });
  S.note('K-GONE', { at: 'RK-B', url: 'http://relay-b.example', label: 'bella gone', present: false });
  S.note('K-LIVE', { at: 'RK-OLD', url: 'http://old.example', label: 'bella stale name', present: false });
  for (let n = 0; n < SLOTS + 10; n += 1) {
    S.note('K-STRANGER-' + n, { at: 'RK-B', label: 'bella stranger ' + n });
  }
  // The owner's own people: more of them than a search has slots, and one
  // last seen absent.
  for (let n = 0; n < SLOTS + 5; n += 1) {
    contactBook.acquire(H, { publicKey: 'K-FRIEND-' + n, publicLabel: 'bella friend ' + n });
  }
  S.note('K-FRIEND-0', { at: 'RK-B', label: 'bella friend 0', present: false });
  const seenBefore = S.get('K-MEM').seen;

  test.subHeading('Online: memory answers now, the relays\' rows follow');

  const live = relayAnswering([{ publicKey: 'K-LIVE', publicLabel: 'bella live' }]);
  const on = await search(H, 'bella', live);
  const m = rowsOf(on.body);

  const liveNet = on.net.filter(function (i) { return i.key === 'K-LIVE'; });
  let liveRow = null;
  try { liveRow = JSON.parse(liveNet[0].label); } catch (e) { liveRow = null; }
  if (on.status === 200 && liveNet.length === 1 && liveRow && liveRow.publicLabel === 'bella live' && liveRow.present === true &&
      m.filter(function (r) { return r.publicKey === 'K-LIVE'; }).length <= 1) {
    test.check('a peer the relay answered for follows once, as the relay said it, present; memory\'s answer holds it at most once');
  } else {
    test.fail('live row: ' + JSON.stringify(liveNet) + ', in memory\'s answer ' + m.filter(function (r) { return r.publicKey === 'K-LIVE'; }).length);
  }
  // WHAT THE NETWORK FINDS IS HELD (goal/G40.11, box v24: "what the network search finds is held"): the next search
  // lists it, under the name the relay gave, waiting for the owner's yes.
  const after = rowsOf((await search(H, 'bella live', null)).body);
  const liveAfter = byKey(after, 'K-LIVE');
  if (liveAfter && liveAfter.name === 'bella live' && liveAfter.held === true && liveAfter.keep === false) test.check('and the next search lists it held, under the name the relay gave');
  else test.fail('after the walk, the search holds K-LIVE as ' + JSON.stringify(liveAfter));

  // NO STRANGERS FROM THE SHADOW (goal/G40.11: "the search lists kept and held rows only"; fromMemory went): somebody
  // the node has only heard of is not listed, absent or present.
  if (!byKey(m, 'K-MEM') && !byKey(m, 'K-GONE')) {
    test.check('somebody only the shadow knows, present or absent, is not listed');
  } else {
    test.fail('a shadow stranger was listed: ' + JSON.stringify(byKey(m, 'K-MEM') || byKey(m, 'K-GONE')));
  }

  const strangers = m.filter(function (r) { return /^K-STRANGER-/.test(r.publicKey); }).length;
  if (strangers === 0) {
    test.check('and none of the ' + (SLOTS + 10) + ' strangers the shadow holds take a row');
  } else {
    test.fail(strangers + ' strangers listed');
  }

  const friends = m.filter(function (r) { return /^K-FRIEND-/.test(r.publicKey); });
  if (friends.length === SLOTS + 5 && byKey(friends, 'K-FRIEND-0')) {
    test.check('every one of the ' + (SLOTS + 5) + ' kept who match is returned — past the slots, and the one last seen absent');
  } else {
    test.fail(friends.length + ' friends of ' + (SLOTS + 5) + ', friend 0: ' + JSON.stringify(byKey(friends, 'K-FRIEND-0')));
  }

  if (friends.every(function (r) { return r.keep === true && r.held === false; })) {
    test.check('and each row says it is kept, a flag on its row (the book field went with goal/G40.11)');
  } else {
    test.fail('flags: ' + JSON.stringify(friends.slice(0, 3)));
  }

  if (S.get('K-MEM').seen === seenBefore) {
    test.check('a remembered row is not written back as though it were news — its date is untouched');
  } else {
    test.fail('the search re-stamped a remembered row');
  }

  const none = await search(H, 'zzzz', null);
  if (rowsOf(none.body).length === 0) {
    test.check('the table is matched like a relay: a name nobody has finds nobody');
  } else {
    test.fail('zzzz matched: ' + JSON.stringify(rowsOf(none.body)));
  }

  test.subHeading('A relay that does not answer: the table answers for it');

  const quiet = await search(H, 'bella friend 1', relayAnswering(null));
  if (quiet.status === 200 && byKey(rowsOf(quiet.body), 'K-FRIEND-1') && quiet.net.length === 0) {
    test.check('the kept rows are still found, and the silent relay adds nobody');
  } else {
    test.fail('quiet: ' + JSON.stringify(quiet.body) + ', network rows ' + JSON.stringify(quiet.net));
  }

  test.subHeading('Not connected at all: the table, instead of a refusal');

  const off = await search(H, 'bella friend 1', null);
  if (off.status === 200 && byKey(rowsOf(off.body), 'K-FRIEND-1') && off.net.length === 0) {
    test.check('a node with no connection answers from its table (it used to answer 503), asking nobody');
  } else {
    test.fail('offline: ' + off.status + ' ' + JSON.stringify(off.body));
  }

  test.subHeading('The listed rows are read through their partial indexes');

  {
    // THE NEWEST-FIRST CAP ON STRANGERS STOOD HERE (R39: "cap at 1000 rows compared"): no stranger is read since
    // goal/G40.11. What is read is the kept, the owned and the held, each through its own partial index.
    const C = makeHome();
    contactBook.acquire(C, { publicKey: 'K-OLD-FRIEND', publicLabel: 'carl friend' });
    const T = hubModule.shadow(C);
    for (let n = 0; n < 10; n += 1) T.note('K-CARL-' + n, { at: 'RK-B', label: 'carl ' + n });
    const got = await search(C, 'carl', null);
    // People only: the node's kept relay is a row of the same search and may match a word in its address.
    const keys = (rowsOf(got.body)).filter(function (r) { return !r.relay; }).map(function (r) { return r.publicKey; });
    if (keys.join(',') === 'K-OLD-FRIEND') {
      test.check("the owner's friend is found, and the ten strangers matching the same word are not");
    } else {
      test.fail('found: ' + keys.join(','));
    }
    // ON AN INDEX, asserted rather than assumed: a partial index is used only while the query repeats its condition.
    const db = new (require('node:sqlite').DatabaseSync)(path.join(C, 'relay-state', 'node.db'));
    const plan = function (sql) { return db.prepare('EXPLAIN QUERY PLAN ' + sql).all().map(function (r) { return r.detail; }).join(' | '); };
    const listed = plan('SELECT * FROM seen WHERE keep = 1 UNION SELECT * FROM seen WHERE mine = 1 UNION SELECT * FROM seen WHERE held = 1');
    db.close();
    if (/seen_keep/.test(listed) && /seen_mine/.test(listed) && /seen_held/.test(listed) && !/SCAN seen(?! USING)/.test(listed)) {
      test.check('the list walks seen_keep, seen_mine and seen_held — none scans the table');
    } else {
      test.fail('plan: ' + listed);
    }
  }

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
  process.exit(1);
});
