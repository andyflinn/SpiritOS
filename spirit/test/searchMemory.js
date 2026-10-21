'use strict';

// spirit/test/searchMemory.js
// A SEARCH ASKS MEMORY TOO, BESIDE EVERY BOUND RELAY (R39, 0021).
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
const auth = require('../run/js/relayAuth');
const relayKeys = require('../run/js/relayKeys');
const contactBook = require('../run/js/contacts');
// goal/G29.22: the old graded search is gone; the peer search's slots live in peerRank.
const peerRank = require('../run/js/peerRank');
const hubModule = require('../run/js/hub');

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
    contactBook.acquire(H, { publicKey: 'K-FRIEND-' + n, publicLabel: 'bella friend ' + n }, 'handle');
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
  const after = rowsOf((await search(H, 'bella live', null)).body);
  if (byKey(after, 'K-LIVE') && /^bella live …/.test(byKey(after, 'K-LIVE').name)) test.check('and the next search finds it in memory under the name the relay gave');
  else test.fail('after the walk, memory holds K-LIVE as ' + JSON.stringify(byKey(after, 'K-LIVE')));

  const mem = byKey(m, 'K-MEM');
  if (mem && mem.book === false && mem.present === true && mem.relay === 'http://relay-b.example' && typeof mem.seenAt === 'string') {
    test.check('somebody only memory knows is answered at once, marked not in the book, dated, with the relay they were at');
  } else {
    test.fail('memory row: ' + JSON.stringify(mem));
  }

  if (!byKey(m, 'K-GONE')) {
    test.check('a stranger remembered as absent is dropped, exactly as a relay row would be');
  } else {
    test.fail('an absent stranger was returned');
  }

  const strangers = m.filter(function (r) { return /^K-STRANGER-/.test(r.publicKey); }).length;
  if (strangers > 0 && strangers <= SLOTS && on.body.more === true) {
    test.check('strangers from memory get the slots a relay gets (' + strangers + ' of ' + (SLOTS + 10) +
      '), and the answer says there were more');
  } else {
    test.fail(strangers + ' strangers, more=' + on.body.more);
  }

  const friends = m.filter(function (r) { return /^K-FRIEND-/.test(r.publicKey); });
  if (friends.length === SLOTS + 5 && byKey(friends, 'K-FRIEND-0')) {
    test.check('every one of the ' + (SLOTS + 5) + ' chosen who match is returned — past the slots, and the one last seen absent');
  } else {
    test.fail(friends.length + ' friends of ' + (SLOTS + 5) + ', friend 0: ' + JSON.stringify(byKey(friends, 'K-FRIEND-0')));
  }

  if (friends.every(function (r) { return r.book === true; }) && m.filter(function (r) { return /^K-STRANGER-|^K-MEM$/.test(r.publicKey); }).every(function (r) { return r.book === false; })) {
    test.check('and each row says whether the book holds it (the count of remembered rows went with peer.search)');
  } else {
    test.fail('book marks: ' + JSON.stringify(m.slice(0, 3)));
  }

  if (S.get('K-MEM').seen === seenBefore) {
    test.check('a remembered row is not written back as though it were news — its date is untouched');
  } else {
    test.fail('the search re-stamped a remembered row');
  }

  const none = await search(H, 'zzzz', live);
  if ((rowsOf(none.body)).filter(function (r) { return r.book === false; }).length === 0) {
    test.check('memory is matched like a relay: a name nobody has finds nobody');
  } else {
    test.fail('zzzz matched: ' + JSON.stringify(rowsOf(none.body)));
  }

  test.subHeading('A relay that does not answer: memory answers for it');

  const quiet = await search(H, 'bella remembered', relayAnswering(null));
  if (quiet.status === 200 && byKey(rowsOf(quiet.body), 'K-MEM') && quiet.net.length === 0) {
    test.check('memory still finds who it can, and the silent relay adds nobody');
  } else {
    test.fail('quiet: ' + JSON.stringify(quiet.body) + ', network rows ' + JSON.stringify(quiet.net));
  }

  test.subHeading('Not connected at all: memory, instead of a refusal');

  const off = await search(H, 'bella remembered', null);
  if (off.status === 200 && byKey(rowsOf(off.body), 'K-MEM') && off.net.length === 0) {
    test.check('a node with no connection answers from memory (it used to answer 503), asking nobody');
  } else {
    test.fail('offline: ' + off.status + ' ' + JSON.stringify(off.body));
  }

  test.subHeading('Newest first, and capped — the chosen are read apart');

  {
    //   Andy: "we'll run those searches down a newest-first key and cap at
    //   1000 rows compared. (or a tunable value with default)"
    const C = makeHome();
    fs.writeFileSync(path.join(C, 'relay-state', 'node.json'), JSON.stringify({ searchMemoryRows: 5 }));
    // The friend is the OLDEST row here: a cap that read the chosen with
    // everybody else would lose them first.
    contactBook.acquire(C, { publicKey: 'K-OLD-FRIEND', publicLabel: 'carl friend' }, 'handle');
    const T = hubModule.shadow(C);
    T.note('K-OLD-FRIEND', { at: 'RK-B', label: 'carl friend' });
    for (let n = 0; n < 10; n += 1) T.note('K-CARL-' + n, { at: 'RK-B', label: 'carl ' + n });
    // seen is a millisecond clock; make the order unambiguous.
    const st = require('../run/js/nodeStore').open(C);
    st.seen.put('K-OLD-FRIEND', { seen: 1 });
    for (let n = 0; n < 10; n += 1) st.seen.put('K-CARL-' + n, { seen: 100 + n });

    const got = await search(C, 'carl', null);
    const keys = (rowsOf(got.body)).map(function (r) { return r.publicKey; });
    const carls = keys.filter(function (k) { return /^K-CARL-/.test(k); }).sort();
    if (carls.join(',') === 'K-CARL-5,K-CARL-6,K-CARL-7,K-CARL-8,K-CARL-9') {
      test.check('with the cap at 5, the five newest strangers are compared and the five oldest are not');
    } else {
      test.fail('compared: ' + carls.join(','));
    }
    if (keys.indexOf('K-OLD-FRIEND') !== -1) {
      test.check("and the owner's friend, the oldest row of all, is still found");
    } else {
      test.fail('the old friend was capped away: ' + keys.join(','));
    }

    // BOTH HALVES ON AN INDEX, asserted rather than assumed: the chosen
    // read only uses the partial index while it repeats its condition.
    const db = new (require('node:sqlite').DatabaseSync)(path.join(C, 'relay-state', 'node.db'));
    const plan = function (sql) { return db.prepare('EXPLAIN QUERY PLAN ' + sql).all().map(function (r) { return r.detail; }).join(' | '); };
    const recent = plan("SELECT publicKey FROM seen WHERE label <> '' AND choice NOT IN ('held', 'added') AND blocked = 0 ORDER BY seen DESC LIMIT 1000");
    const chosenPlan = plan("SELECT publicKey FROM seen WHERE (choice <> '' OR blocked = 1) AND (choice IN ('held', 'added') OR blocked = 1)");
    db.close();
    if (/seen_when/.test(recent) && /seen_chosen/.test(chosenPlan)) {
      test.check('newest-first walks seen_when and the chosen read walks seen_chosen — neither scans the table');
    } else {
      test.fail('plans: ' + recent + ' / ' + chosenPlan);
    }
  }

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
  process.exit(1);
});
