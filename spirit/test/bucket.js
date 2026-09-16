'use strict';

// spirit/test/bucket.js
// THE MECHANISM, WITH NO OPINION IN IT.
//
//   Andy: "we have a bucket with limited size, and a stream of incoming
//   results need to be quality-graded, to decide if it has a spot in the
//   list, if yes, the item is inserted into the limited bucket and the
//   weakest match may get thrown out of the bucket, if it's overflowing.
//   the mechanism itself needs to be supplied with a compare function,
//   similar to sort()."
//
// Everything below grades NUMBERS, deliberately. If this file ever needs
// to know what a peer is, the separation it exists to prove has gone: the
// bucket is a data structure and peerSearch is the opinion, and they have
// to be able to change without each other.

const test = require('./testSupport.js');
const { createBucket } = require('../run/js/bucket');

// Smallest first, the way sort() reads.
function smallestFirst(a, b) { return a - b; }

test.startTest('The bucket — limited spots, weakest evicted');

// ---------------------------------------------------------------------
test.subHeading('It holds the best, however they arrive');

{
  const b = createBucket(3, smallestFirst);
  [5, 1, 9, 3, 7].forEach(function (n) { b.offer(n); });

  if (b.items().join(',') === '1,3,5') {
    test.check('three spots keep the best three, in order: ' + b.items().join(', '));
  } else {
    test.fail('held: ' + b.items().join(', '));
  }

  // ORDER OF ARRIVAL MUST NOT MATTER. A partner answering first is not a
  // partner answering better.
  const reversed = createBucket(3, smallestFirst);
  [7, 3, 9, 1, 5].forEach(function (n) { reversed.offer(n); });
  if (reversed.items().join(',') === b.items().join(',')) {
    test.check('and the same five in another order give the same three');
  } else {
    test.fail(reversed.items().join(',') + ' vs ' + b.items().join(','));
  }

  // WORST-FIRST is the case that catches an implementation that only
  // compares against the weakest without re-seating.
  const hostile = createBucket(3, smallestFirst);
  [9, 8, 7, 6, 5, 4, 3, 2, 1].forEach(function (n) { hostile.offer(n); });
  if (hostile.items().join(',') === '1,2,3') {
    test.check('and a stream arriving worst-first still ends best-first');
  } else {
    test.fail('held: ' + hostile.items().join(', '));
  }
}

// ---------------------------------------------------------------------
test.subHeading('It says whether an item took a spot');

{
  const b = createBucket(2, smallestFirst);
  const first = b.offer(5);
  const second = b.offer(3);
  const better = b.offer(1);   // evicts 5
  const worse = b.offer(9);    // never had a chance

  if (first && second && better && !worse) {
    test.check('offer answers true while it places and false once it cannot');
  } else {
    test.fail([first, second, better, worse].join(', '));
  }

  if (b.items().join(',') === '1,3') {
    test.check('and the evicted one is gone: ' + b.items().join(', '));
  } else {
    test.fail('held: ' + b.items().join(', '));
  }
}

// ---------------------------------------------------------------------
test.subHeading('`more` means there were results you are not seeing');

{
  const exact = createBucket(3, smallestFirst);
  [1, 2, 3].forEach(function (n) { exact.offer(n); });
  if (exact.more() === false) {
    test.check('exactly a bucketful is not more');
  } else {
    test.fail('three into three said more');
  }

  // COUNTED, NOT INFERRED. An item can be offered and refused without ever
  // being a candidate — `seen > capacity` would be a different claim, and
  // the one a person reads is "there were others".
  const over = createBucket(3, smallestFirst);
  [1, 2, 3, 99].forEach(function (n) { over.offer(n); });
  if (over.more() === true && over.items().join(',') === '1,2,3') {
    test.check('one too many says more, even though the extra never placed');
  } else {
    test.fail('more=' + over.more() + ' held=' + over.items().join(','));
  }

  // An eviction is also a thing somebody is not seeing.
  const evicting = createBucket(2, smallestFirst);
  [5, 6, 1].forEach(function (n) { evicting.offer(n); });
  if (evicting.more() === true) {
    test.check('and an eviction counts too — the one thrown out is not shown either');
  } else {
    test.fail('eviction did not set more');
  }
}

// ---------------------------------------------------------------------
test.subHeading('It streams: a million offers do not become a million rows');

{
  // THE WHOLE REASON THIS IS NOT sort().slice(). Andy: "Searches for 'a'
  // must be successful, even if there's a million potential peers." A
  // sort would hold a million rows on a 1 GB box while somebody waits.
  const b = createBucket(32, smallestFirst);
  const N = 200000;
  let compares = 0;
  const counting = createBucket(32, function (a, c) { compares++; return a - c; });

  for (let i = N; i > 0; i--) b.offer(i);
  for (let i = 0; i < N; i++) counting.offer(i);

  if (b.size() === 32 && b.items()[0] === 1) {
    test.check(N.toLocaleString() + ' offers, 32 held, the best of them first');
  } else {
    test.fail('size=' + b.size() + ' first=' + b.items()[0]);
  }

  // Ascending input is the BEST case: every item after the first 32 fails
  // one compare against the weakest and is dropped. Roughly N compares,
  // never N log N.
  if (compares < N * 3) {
    test.check('and the ordinary case is about one compare per item — ' +
      compares.toLocaleString() + ' for ' + N.toLocaleString());
  } else {
    test.fail(compares + ' compares for ' + N + ' items');
  }

  if (b.offered() === N) {
    test.check('it remembers how broad the question was: ' + b.offered().toLocaleString() + ' offered');
  } else {
    test.fail('offered=' + b.offered());
  }
}

// ---------------------------------------------------------------------
test.subHeading('It refuses to hold an opinion of its own');

{
  let threw = '';
  try { createBucket(4, null); }
  catch (e) { threw = String(e.message || e); }

  if (/compare/.test(threw)) {
    test.check('no compare, no bucket — it is loud rather than guessing an order');
  } else {
    test.fail('made a bucket with no comparator: ' + threw);
  }

  // A DIFFERENT OPINION, SAME MECHANISM. If this passes, the bucket really
  // is generic and peerSearch's ranking is genuinely replaceable.
  const longestFirst = createBucket(2, function (a, b2) { return b2.length - a.length; });
  ['aa', 'a', 'aaaa', 'aaa'].forEach(function (s) { longestFirst.offer(s); });
  if (longestFirst.items().join(',') === 'aaaa,aaa') {
    test.check('and the opposite comparator gives the opposite bucket');
  } else {
    test.fail('held: ' + longestFirst.items().join(', '));
  }
}

// ---------------------------------------------------------------------
test.subHeading('The edges are answers, not special cases');

{
  const none = createBucket(0, smallestFirst);
  const placed = none.offer(1);
  if (!placed && none.items().length === 0 && none.more() === true) {
    test.check('a bucket with no spots keeps nothing and says there were more');
  } else {
    test.fail('zero-capacity: placed=' + placed + ' more=' + none.more());
  }

  const empty = createBucket(5, smallestFirst);
  if (empty.items().length === 0 && empty.more() === false && empty.size() === 0) {
    test.check('and one nobody offered anything to is empty rather than undefined');
  } else {
    test.fail('empty bucket: ' + JSON.stringify(empty.items()));
  }

  // items() HANDS OUT A COPY. A caller that sorted the result again would
  // be re-opening the question the comparator closed — and doing it to the
  // bucket's own array would corrupt the next offer.
  const b = createBucket(3, smallestFirst);
  [3, 1, 2].forEach(function (n) { b.offer(n); });
  b.items().push(999);
  b.items().sort(function (a, c) { return c - a; });
  if (b.items().join(',') === '1,2,3') {
    test.check('and what it hands back is a copy — the bucket cannot be edited from outside');
  } else {
    test.fail('held after tampering: ' + b.items().join(','));
  }
}

test.reportSuccessFailureCount();
