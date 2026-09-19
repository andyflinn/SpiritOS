'use strict';

// spirit/test/diskClient.js
// RAM IS A CLIENT OF DISC — measured, not claimed.
//
//   Andy: "storage is actually moved from RAM to DISC, and RAM must become
//   a DISC-client." — cycle 3.
//
// The cheap measurement that proves it (NODE-AND-RELAY: first we only
// measure cheap measurements): two relays, one holding 10,000 members and
// one holding 10, built in this process. Until cycle 3 createRelay read the
// whole roll into a map, and the big one would sit megabytes heavier. Now
// the difference in JS heap must be noise.
//
// In-process rather than two spawned relays reading their owner reports:
// the report's heapUsed is this same number taken from a process whose
// other allocations the suite cannot control, and a margin wide enough for
// that noise would be wide enough to hide a resident roll.
//
// And the properties that make the heap flat without making the relay
// wrong: search answers from the connected members' rows in RAM and reads
// nothing off disc (since 2026-09-19 — it walked all 10,000 by cursor
// before), and an unknown sender is refused by one keyed read, never a scan.

const os = require('os');
const fs = require('fs');
const path = require('path');
const v8 = require('v8');
const vm = require('vm');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const relayStore = require('../run/js/relayStore');
const { createRelay } = require('../run/js/relay');

v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc');

const BIG = 10000;
const SMALL = 10;
// Half a megabyte. Holding these 10,000 rows in a map, as relay.js did
// before cycle 3, measured about 2.1 MB (2026-09-19) — four times this.
const MARGIN = 512 * 1024;

function heap() {
  gc(); gc();
  return process.memoryUsage().heapUsed;
}

// A relay home with `n` members, written OFFLINE — straight into relay.db,
// the way an import or a long-lived relay leaves it — plus a real owner.
function homeWith(tag, n) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-disc-' + tag + '-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  auth.writeAllowKeys(home, [{ name: 'owner', publicKey: owner.publicKey }]);
  const store = relayStore.open(home);
  // One member with a real key, so something besides the owner can sign.
  const real = auth.generateIdentity('real');
  store.transaction(function () {
    store.members.put({ publicKey: owner.publicKey, publicLabel: 'owner', claimedAt: '2026-01-01' });
    store.members.put({ publicKey: real.publicKey, publicLabel: 'real', claimedAt: '2026-01-01' });
    for (let i = 0; i < n; i += 1) {
      const pad = String(i).padStart(5, '0');
      store.members.put({
        publicKey: 'MCowBQYDK2VwAyEA' + pad + 'x'.repeat(23),
        publicLabel: 'member' + pad,
        claimedAt: '2026-01-02',
      });
    }
  });
  return { home: home, owner: owner, real: real };
}

function sinkFor(bag) {
  return {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (!ev) return;
      let parsed = null;
      try { parsed = da ? JSON.parse(da[1]) : null; } catch (e) { parsed = null; }
      bag.push({ event: ev[1], data: parsed });
    },
    close: function () {},
  };
}

function post(box, from, toKey, bodyObj) {
  const text = JSON.stringify({ v: 1, body: bodyObj });
  return box.routePost(from.publicKey, toKey, text,
    auth.sign(from.privateKey, auth.postMessage(from.publicKey, toKey, text)));
}

function lastReply(bag) {
  const replies = bag.filter(function (m) { return m.event === 'reply'; });
  if (!replies.length) return null;
  try { return JSON.parse(replies[replies.length - 1].data.text).body || null; }
  catch (e) { return null; }
}


function replies(bag) {
  return bag.filter(function (m) { return m.event === 'reply'; }).length;
}

function until(pred, ms) {
  const end = Date.now() + ms;
  return new Promise(function (resolve) {
    (function poll() {
      if (pred() || Date.now() > end) { resolve(pred()); return; }
      setTimeout(poll, 5);
    })();
  });
}

// What the relay costs in heap once it is up and has answered a search.
// The search walks asynchronously (walkRoll), so the answer is awaited.
async function relayCost(fixture) {
  const before = heap();
  const box = createRelay(fixture.home);
  const bag = [];
  box.streamOpen(fixture.owner.publicKey,
    auth.sign(fixture.owner.privateKey, auth.streamMessage(fixture.owner.publicKey)), sinkFor(bag));
  post(box, fixture.owner, box.relayPublicKey(), { search: { q: 'member0004' } });
  await until(function () { return replies(bag) > 0; }, 10000);
  const after = heap();
  return { box: box, bag: bag, bytes: after - before };
}

test.startTest('RAM is a client of disc — a big roll costs no heap, and blocks nothing');

async function run() {
  const big = homeWith('big', BIG);
  const small = homeWith('small', SMALL);

  // Warm the code paths once, so the first relay built does not pay for
  // compiling what the second then gets free.
  await relayCost(homeWith('warm', 3));

  const S = await relayCost(small);
  const B = await relayCost(big);

  test.subHeading(BIG + ' members against ' + SMALL);

  const diff = B.bytes - S.bytes;
  if (diff < MARGIN) {
    test.check('the relay over ' + BIG + ' members is within ' + Math.round(MARGIN / 1024) +
      ' KB of the one over ' + SMALL + ': ' + Math.round(diff / 1024) + ' KB apart');
  } else {
    test.fail('a big roll costs heap: ' + Math.round(B.bytes / 1024) + ' KB against ' +
      Math.round(S.bytes / 1024) + ' KB — something holds the roll in RAM');
  }

  test.subHeading('Search finds who is connected, and nobody else');

  // Andy (2026-09-19): "Search should respond with active/online members
  // only. A node can reconcile with its contact list to conclude that a
  // contact is offline." Until then this section asserted the opposite —
  // "search still sees all of them", a ranked walk of all 10,000 rows off
  // disc, and that a request arriving mid-walk was answered first. The
  // walk is over the connected members' rows in RAM now (relay.js
  // walkRoll), bounded by the connection allowance, so neither the disc
  // walk nor its stall exists to measure.
  const answer = lastReply(B.bag);
  if (answer && answer.ok && (answer.matches || []).length === 0) {
    test.check(BIG + ' members on the roll and none connected: a search finds nobody');
  } else {
    test.fail('search: ' + JSON.stringify(answer && { ok: answer.ok, n: (answer.matches || []).length }));
  }

  const realSink = [];
  B.box.streamOpen(big.real.publicKey,
    auth.sign(big.real.privateKey, auth.streamMessage(big.real.publicKey)), sinkFor(realSink));
  let n = replies(B.bag);
  post(B.box, big.owner, B.box.relayPublicKey(), { search: { q: 'real' } });
  await until(function () { return replies(B.bag) > n; }, 10000);
  const found = lastReply(B.bag);
  const top = found && found.matches && found.matches[0];
  if (top && top.publicLabel === 'real' && found.matches.length === 1) {
    test.check('and once one of them connects, a search finds them');
  } else {
    test.fail('connected: ' + JSON.stringify(found));
  }

  // Nothing about a found row says whether they are here: they all are.
  // Nor who owns the relay — a row does not know (2026-09-19).
  if (top && !('present' in top) && !('owner' in top)) {
    test.check('a found row carries neither present nor owner');
  } else {
    test.fail('row fields: ' + JSON.stringify(top));
  }

  test.subHeading('A search reads nothing off disc');

  // Every read the store offers, counted. relay.js reaches the store
  // through relayStore.open(home), the same cached object this suite holds.
  const members = relayStore.open(big.home).members;
  const readers = ['get', 'byLabel', 'byKeys', 'each', 'count'];
  const real = {};
  let discReads = 0;
  readers.forEach(function (name) {
    real[name] = members[name];
    members[name] = function () { discReads += 1; return real[name].apply(members, arguments); };
  });

  n = replies(B.bag);
  post(B.box, big.owner, B.box.relayPublicKey(), { search: { q: 'member' } });
  await until(function () { return replies(B.bag) > n; }, 10000);
  if (replies(B.bag) > n && discReads === 0) {
    test.check('a search over a relay holding ' + BIG + ' members answers without one disc read');
  } else {
    test.fail('disc reads during a search: ' + discReads);
  }

  test.subHeading('An unknown sender is refused');

  const stranger = auth.generateIdentity('stranger');
  const refused = post(B.box, stranger, B.box.relayPublicKey(), { partners: true });
  if (refused && refused.ok === false) {
    test.check('a key with no row is refused (' + refused.status + ')');
  } else {
    test.fail('stranger: ' + JSON.stringify(refused));
  }
  readers.forEach(function (name) { members[name] = real[name]; });

  test.subHeading('A connected member is served from RAM');

  // Andy, cycle 3: cache the rows of ACTIVE members, bounded by the
  // connection allowance. A member holding a stream is resolved without a
  // disc read; one who is not costs exactly one keyed read.
  const realGet = members.get;
  let reads = [];
  members.get = function (k) { reads.push(k); return realGet(k); };

  const before = replies(realSink);
  reads = [];
  post(B.box, big.real, B.box.relayPublicKey(), { partners: true });
  const reply = replies(realSink) > before ? lastReply(realSink) : null;
  if (reply && reply.ok && reads.indexOf(big.real.publicKey) === -1) {
    test.check('a member with an open stream posts without its row being read from disc');
  } else {
    test.fail('reads=' + JSON.stringify(reads.map(function (k) { return String(k).slice(-6); })) +
      ' reply=' + JSON.stringify(reply));
  }

  reads = [];
  post(B.box, stranger, B.box.relayPublicKey(), { partners: true });
  if (reads.filter(function (k) { return k === stranger.publicKey; }).length === 1) {
    test.check('and a stranger costs one keyed read of the disc, success or fail');
  } else {
    test.fail('stranger reads: ' + reads.length);
  }
  members.get = realGet;

  test.subHeading('Every operation is by key');

  // Andy, cycle 3: labels serve search and display only. Before cycle 3 a
  // sender or a target could be named by label and resolved by a scan.
  const asLabel = post(B.box, { publicKey: 'real', privateKey: big.real.privateKey },
    B.box.relayPublicKey(), { partners: true });
  if (asLabel && asLabel.ok === false) {
    test.check('a sender named by label is refused, even signing with the right key (' + asLabel.status + ')');
  } else {
    test.fail('label as sender: ' + JSON.stringify(asLabel));
  }

  const toLabel = post(B.box, big.real, 'owner', { ping: 1 });
  if (toLabel && toLabel.ok === false) {
    test.check('and a target named by label is not a peer (' + toLabel.status + ')');
  } else {
    test.fail('label as target: ' + JSON.stringify(toLabel));
  }

  relayStore.closeAll();
  [big.home, small.home].forEach(function (h) {
    try { fs.rmSync(h, { recursive: true, force: true }); } catch (e) { /* windows */ }
  });
}

run()
  .catch(function (e) { test.fail(String(e && e.stack ? e.stack : e)); })
  .then(function () { test.reportSuccessFailureCount(); });
