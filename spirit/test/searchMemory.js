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
const gradedSearch = require('../run/js/gradedSearch');
const hubModule = require('../run/js/hub');

const RELAY = 'http://relay-a.example';
const SLOTS = gradedSearch.SLOTS;

function makeHome() {
  const H = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-searchmem-'));
  auth.saveIdentity(H, auth.generateIdentity('me'));
  fs.mkdirSync(path.join(H, 'app', 'natter'), { recursive: true });
  fs.writeFileSync(path.join(H, 'app', 'natter', 'relays.json'),
    JSON.stringify([{ url: RELAY, label: 'A' }]));
  relayKeys.accept(H, RELAY, 'RELAYKEY-A');
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

function search(H, q, router) {
  return new Promise(function (resolve) {
    const res = {
      status: 0,
      writeHead: function (s) { res.status = s; },
      setHeader: function () {},
      end: function (b) {
        let parsed = null;
        try { parsed = JSON.parse(b); } catch (e) { parsed = { raw: String(b) }; }
        resolve({ status: res.status, body: parsed });
      },
    };
    hubModule.createHub(H).handleSearch({}, res,
      function () { return Promise.resolve({ q: q }); },
      { router: router });
  });
}

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

  test.subHeading('Online: the relays lead, memory fills in');

  const live = relayAnswering([{ publicKey: 'K-LIVE', publicLabel: 'bella live' }]);
  const on = await search(H, 'bella', live);
  const m = on.body.matches || [];

  const liveRow = byKey(m, 'K-LIVE');
  if (on.status === 200 && liveRow && !liveRow.fromMemory && liveRow.publicLabel === 'bella live' &&
      m.filter(function (r) { return r.publicKey === 'K-LIVE'; }).length === 1) {
    test.check('a peer the relay answered for appears once, as the relay said it — the live row wins over the remembered one');
  } else {
    test.fail('live row: ' + JSON.stringify(liveRow));
  }

  const mem = byKey(m, 'K-MEM');
  if (mem && mem.fromMemory === true && mem.present === true && mem.relay === 'http://relay-b.example' &&
      mem.atKey === 'RK-B' && typeof mem.seenAt === 'string') {
    test.check('somebody only memory knows is filled in, marked as remembered, dated, with their route');
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

  if (on.body.remembered === m.filter(function (r) { return r.fromMemory; }).length) {
    test.check('and the answer counts how many came from memory: ' + on.body.remembered);
  } else {
    test.fail('remembered=' + on.body.remembered);
  }

  if (S.get('K-MEM').seen === seenBefore) {
    test.check('a remembered row is not written back as though it were news — its date is untouched');
  } else {
    test.fail('the search re-stamped a remembered row');
  }

  const none = await search(H, 'zzzz', live);
  if ((none.body.matches || []).filter(function (r) { return r.fromMemory; }).length === 0) {
    test.check('memory is matched like a relay: a name nobody has finds nobody');
  } else {
    test.fail('zzzz matched: ' + JSON.stringify(none.body.matches));
  }

  test.subHeading('A relay that does not answer: memory answers for it');

  const quiet = await search(H, 'bella remembered', relayAnswering(null));
  if (quiet.status === 200 && byKey(quiet.body.matches, 'K-MEM') &&
      (quiet.body.silent || []).indexOf(RELAY) !== -1) {
    test.check('the relay is named as silent, and memory still finds who it can');
  } else {
    test.fail('quiet: ' + JSON.stringify(quiet.body));
  }

  test.subHeading('Not connected at all: memory, instead of a refusal');

  const off = await search(H, 'bella remembered', null);
  if (off.status === 200 && byKey(off.body.matches, 'K-MEM') && off.body.asked === 0 &&
      (off.body.silent || []).indexOf(RELAY) !== -1) {
    test.check('a node with no connection answers from memory (it used to answer 503), asking nobody and saying so');
  } else {
    test.fail('offline: ' + off.status + ' ' + JSON.stringify(off.body));
  }

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
  process.exit(1);
});
