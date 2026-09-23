'use strict';

// spirit/test/replayIndex.js
// THE SAME SEALED MESSAGE ARRIVES TWICE AND REACHES AN APP ONCE.
// Cycle 10's R17 and C2.
//
// ── THE GAP THIS CLOSES, AND WHY THE RELAY CANNOT ────────────────────
//
// A relay refuses a hash it has already registered. But cycle 10's R4
// leaves the relay OUT of the associated data on purpose — binding a
// message to a road would make store-and-forward a routing promise — so
// the same sealed blob, replayed through a DIFFERENT relay, meets a guard
// that has never seen it. Every signature verifies. The seal opens. The
// app is handed the message a second time.
//
// The recipient is the only party that sees every road, so the recipient
// keeps the index.
//
// **wsl-claude's condition on cycle 10's R4, which is what this is for:**
// repeating a note is a duplicate line in a log; repeating something that
// consumes, mints, spends or toggles is a bug with a credential in it. No
// non-idempotent app verb ships before this.
//
// ── WHY AGE IS REFUSED BY THE SAME MECHANISM (C2) ────────────────────
//
// The index is bounded by disc like every dataset here, so it WILL be
// trimmed — and at that moment old messages would become replayable
// again, silently. So the sender's timestamp travels INSIDE the seal
// (never in the envelope, where it would leak and be forgeable), the
// window and the memory are the SAME NUMBER, and a hash can only be
// dropped once a message bearing it would be refused for age anyway.
//
// A message older than the window is therefore not refused as suspicious.
// It is refused because **the index cannot vouch either way.**

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const seal = require('../run/js/seal');
const nodeStore = require('../run/js/nodeStore');

test.startTest('A recipient refuses a replayed sealed message');

const homes = [];
function home() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-replay-'));
  homes.push(d);
  fs.mkdirSync(path.join(d, 'relay-state'), { recursive: true });
  return d;
}

test.subHeading('The index tells the four states apart');

{
  const st = nodeStore.open(home());
  const now = Date.now();

  const first = st.replay.seen('h-one', now, now);
  st.replay.remember('h-one', now);
  const second = st.replay.seen('h-one', now, now);

  if (first === 'new' && second === 'again') {
    test.check('a hash is new once and `again` for ever after — which is the whole requirement');
  } else {
    test.fail('first ' + first + ', second ' + second);
  }

  // OLD IS NOT AN ACCUSATION. Its hash may already have been swept, so
  // the index has nothing to say — and accepting it would be exactly the
  // hole C2 exists to close.
  const stale = st.replay.seen('h-old', now - st.replay.WINDOW_MS - 1000, now);
  if (stale === 'old') {
    test.check('a message older than the window is `old` — the index cannot vouch, so it must not be delivered');
  } else {
    test.fail('an ancient message was judged ' + stale);
  }

  // CLOCK SKEW IS TOLERATED, past tolerance is not. A node an hour fast
  // must not have every message refused as being from the future.
  const skewed = st.replay.seen('h-skew', now + (st.replay.SKEW_MS / 2), now);
  const ahead = st.replay.seen('h-ahead', now + st.replay.SKEW_MS + 60000, now);
  if (skewed === 'new' && ahead === 'ahead') {
    test.check('half an hour fast is accepted, past the skew tolerance is not — a fast clock is not a forgery');
  } else {
    test.fail('skewed ' + skewed + ', ahead ' + ahead);
  }
}

test.subHeading('THE WINDOW AND THE MEMORY ARE ONE NUMBER (C2)');

{
  // The condition, asserted as a relationship rather than as two figures.
  // If a sweep ever dropped rows a message could still be accepted at,
  // that gap is precisely when an old message becomes replayable with
  // nothing noticing.
  const st = nodeStore.open(home());
  const now = Date.now();

  const justInside = now - st.replay.WINDOW_MS + 60000;
  st.replay.remember('h-edge', justInside);

  const beforeSweep = st.replay.seen('h-edge', justInside, now);
  const swept = st.replay.sweep(now);
  const afterSweep = st.replay.seen('h-edge', justInside, now);

  if (beforeSweep === 'again' && swept === 0 && afterSweep === 'again') {
    test.check('a hash still inside the window survives a sweep — nothing is dropped while a ' +
      'message bearing it would still be accepted');
  } else {
    test.fail('edge row: before ' + beforeSweep + ', swept ' + swept + ', after ' + afterSweep);
  }

  // And one that has aged out goes, because keeping it for ever is the
  // unbounded growth cycle 9 forbids.
  st.replay.remember('h-gone', now - st.replay.WINDOW_MS - 60000);
  const dropped = st.replay.sweep(now);
  if (dropped === 1 && st.replay.seen('h-gone', now - st.replay.WINDOW_MS - 60000, now) === 'old') {
    test.check('and one past the window is swept — and is refused for AGE afterwards, not accepted as new');
  } else {
    test.fail('aged row was not swept, or was accepted afterwards');
  }
}

test.subHeading('It rebuilds from the log, and answers identically');

{
  //   "a derived thing that cannot be rebuilt is a single point of silent
  //   weakening."
  //
  // Losing node.db must cost a rebuild, not the protection. The rows are
  // what a walk of traffic.jsonl yields: the hash it logged and the
  // sender's sealed timestamp beside it.
  const now = Date.now();
  const fromLog = [
    { hash: 'a1', at: now - 1000 },
    { hash: 'b2', at: now - 2000 },
    { hash: 'c3', at: now - 3000 },
  ];

  const original = nodeStore.open(home());
  fromLog.forEach(function (r) { original.replay.remember(r.hash, r.at); });
  const before = fromLog.map(function (r) { return original.replay.seen(r.hash, r.at, now); });

  // A DIFFERENT NODE.DB ENTIRELY — the loss this is insurance against.
  const rebuilt = nodeStore.open(home());
  const n = rebuilt.replay.rebuild(fromLog);
  const after = fromLog.map(function (r) { return rebuilt.replay.seen(r.hash, r.at, now); });

  if (n === 3 && before.join(',') === after.join(',') && after.every(function (v) { return v === 'again'; })) {
    test.check('a rebuilt index answers identically to the one that was lost — ' +
      'the protection survives losing node.db');
  } else {
    test.fail('before ' + before.join(',') + ' after ' + after.join(',') + ' rebuilt ' + n);
  }

  // Twice, because that is the state a crash leaves and the state an
  // operator will actually be in.
  const again = rebuilt.replay.rebuild(fromLog);
  if (again === 3 && rebuilt.replay.count() === 3) {
    test.check('and rebuilding twice is safe — a half-populated index is what a crash leaves behind');
  } else {
    test.fail('second rebuild left ' + rebuilt.replay.count() + ' rows');
  }
}

test.subHeading('THE POINT: the same sealed blob, replayed, is refused');

{
  // End to end on the real seal, because everything above tests the index
  // and this tests the thing the index is FOR: one blob, two arrivals.
  const A = auth.generateIdentity('anna');
  const B = auth.generateIdentity('bert');
  const st = nodeStore.open(home());
  const now = Date.now();

  const blob = JSON.stringify(seal.seal(
    B.sealPublicKey, A.publicKey, B.publicKey,
    JSON.stringify({ app: 'wallet', v: 1, body: { spend: 500 } }), now));

  // The hash the wire commits to is over what travels — the sealed bytes.
  const hash = auth.requestHash(auth.postMessage(A.publicKey, B.publicKey, blob));

  const opened = seal.open(B.sealPrivateKey, A.publicKey, B.publicKey, blob);
  const firstVerdict = st.replay.seen(hash, opened.at, now);
  st.replay.remember(hash, opened.at);

  // REPLAYED THROUGH ANOTHER RELAY: byte-for-byte the same blob, the same
  // signature, the same hash. Nothing about it is forged and nothing
  // upstream can tell.
  const secondVerdict = st.replay.seen(hash, opened.at, now);

  if (firstVerdict === 'new' && secondVerdict === 'again' && opened.at) {
    test.check('the same sealed blob arriving a second time is REFUSED — a spend delivered ' +
      'twice is the bug this requirement exists for');
  } else {
    test.fail('first ' + firstVerdict + ', second ' + secondVerdict + ', sealed at ' + opened.at);
  }

  // THE CONTROL. A different message from the same sender must still get
  // through, or this would be refusing everything and passing.
  const other = JSON.stringify(seal.seal(
    B.sealPublicKey, A.publicKey, B.publicKey,
    JSON.stringify({ app: 'wallet', v: 1, body: { spend: 501 } }), now));
  const otherHash = auth.requestHash(auth.postMessage(A.publicKey, B.publicKey, other));
  if (st.replay.seen(otherHash, now, now) === 'new') {
    test.check('and a different message from the same sender is still new — the test can fail');
  } else {
    test.fail('the index refused an unrelated message');
  }
}

try { nodeStore.closeAll && nodeStore.closeAll(); } catch (e) { /* leave it */ }
homes.forEach(function (h) {
  try { fs.rmSync(h, { recursive: true, force: true }); } catch (e) { /* sweeper */ }
});

test.reportSuccessFailureCount();
