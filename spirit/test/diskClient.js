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
// And the two properties that make the heap flat without making the relay
// wrong: search still ranks across all 10,000 (by cursor, keeping only the
// best), and an unknown sender is refused by one keyed read, never a scan.

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
    store.members.put({ publicKey: owner.publicKey, publicLabel: 'owner', claimedAt: '2026-01-01', owner: true });
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

// What the relay costs in heap once it is up and has answered a search.
function relayCost(fixture) {
  const before = heap();
  const box = createRelay(fixture.home);
  const bag = [];
  box.streamOpen(fixture.owner.publicKey,
    auth.sign(fixture.owner.privateKey, auth.streamMessage(fixture.owner.publicKey)), sinkFor(bag));
  post(box, fixture.owner, box.relayPublicKey(), { search: { q: 'member0004' } });
  const after = heap();
  return { box: box, bag: bag, bytes: after - before };
}

test.startTest('RAM is a client of disc — a big roll costs no heap');

const big = homeWith('big', BIG);
const small = homeWith('small', SMALL);

// Warm the code paths once, so the first relay built does not pay for
// compiling what the second then gets free.
relayCost(homeWith('warm', 3));

const S = relayCost(small);
const B = relayCost(big);

test.subHeading(BIG + ' members against ' + SMALL);

const diff = B.bytes - S.bytes;
if (diff < MARGIN) {
  test.check('the relay over ' + BIG + ' members is within ' + Math.round(MARGIN / 1024) +
    ' KB of the one over ' + SMALL + ': ' + Math.round(diff / 1024) + ' KB apart');
} else {
  test.fail('a big roll costs heap: ' + Math.round(B.bytes / 1024) + ' KB against ' +
    Math.round(S.bytes / 1024) + ' KB — something holds the roll in RAM');
}

test.subHeading('Search still sees all of them');

const answer = lastReply(B.bag);
const labels = ((answer && answer.matches) || []).map(function (m) { return m.publicLabel; });
if (answer && answer.ok && labels.length && labels.every(function (l) { return l.indexOf('member0004') === 0; })) {
  test.check('a search over ' + BIG + ' rows answers from the cursor: ' + labels.length + ' ranked matches');
} else {
  test.fail('search: ' + JSON.stringify(answer && { ok: answer.ok, n: labels.length, first: labels[0] }));
}

post(B.box, big.owner, B.box.relayPublicKey(), { search: { q: 'member09999' } });
const exact = lastReply(B.bag);
const top = exact && exact.matches && exact.matches[0];
if (top && top.publicLabel === 'member09999') {
  test.check('and the last row written is found first when asked for exactly');
} else {
  test.fail('exact: ' + JSON.stringify(top));
}

test.subHeading('An unknown sender costs one read');

// Count every walk of the roll. relay.js reaches the store through
// relayStore.open(home), the same cached object this suite holds.
const members = relayStore.open(big.home).members;
const realEach = members.each;
let walks = 0;
members.each = function (fn) { walks += 1; return realEach(fn); };

const stranger = auth.generateIdentity('stranger');
const refused = post(B.box, stranger, B.box.relayPublicKey(), { partners: true });
if (refused && refused.ok === false && walks === 0) {
  test.check('a key with no row is refused (' + refused.status + ') without walking the roll');
} else {
  test.fail('stranger: ' + JSON.stringify(refused) + ' walks=' + walks);
}

// And the counter is awake: a search is exactly one walk.
post(B.box, big.owner, B.box.relayPublicKey(), { search: { q: 'member' } });
if (walks === 1) {
  test.check('while a search is exactly one walk — the counter is not asleep');
} else {
  test.fail('search walked ' + walks + ' time(s)');
}
members.each = realEach;

test.subHeading('A connected member is served from RAM');

// Andy, cycle 3: cache the rows of ACTIVE members, bounded by the
// connection allowance. A member holding a stream is resolved without a
// disc read; one who is not costs exactly one keyed read.
const realGet = members.get;
let reads = [];
members.get = function (k) { reads.push(k); return realGet(k); };

const realSink = [];
B.box.streamOpen(big.real.publicKey,
  auth.sign(big.real.privateKey, auth.streamMessage(big.real.publicKey)), sinkFor(realSink));
reads = [];
post(B.box, big.real, B.box.relayPublicKey(), { partners: true });
const reply = lastReply(realSink);
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

test.reportSuccessFailureCount();
