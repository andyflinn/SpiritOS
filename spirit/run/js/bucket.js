'use strict';

// spirit/run/js/bucket.js
// A BUCKET WITH A FIXED NUMBER OF SPOTS, FED ONE ITEM AT A TIME.
//
//   Andy: "we have a bucket with limited size, and a stream of incoming
//   results need to be quality-graded, to decide if it has a spot in the
//   list, if yes, the item is inserted into the limited bucket and the
//   weakest match may get thrown out of the bucket, if it's overflowing.
//   the mechanism itself needs to be supplied with a compare function,
//   similar to sort()."
//
// ── WHY NOT SORT AND SLICE ───────────────────────────────────────────
//
// Because of the number that made the search worth building:
//
//   Andy: "Searches for 'a' must be successful, even if there's a million
//   potential peers."
//
// Sorting a million rows to keep thirty-two costs a million rows of
// memory and n·log n compares, on a 1 GB box, while somebody holds a
// connection open. This costs THIRTY-TWO rows and one compare per item in
// the ordinary case — the check against the weakest spot, which almost
// always says no.
//
//   sort + slice   O(n) memory, O(n log n) compares
//   this           O(k) memory, O(n) compares, k = capacity
//
// ── AND IT COMPOSES, WHICH IS THE OTHER HALF ─────────────────────────
//
// Several sources answering one question pour into ONE bucket, so the cap
// holds across the merge without anybody counting. A source that answers
// late is offered when it arrives rather than forcing a re-sort, and a
// source that answers in a hostile order cannot get its worst row into
// the result, because order is never believed — only `compare` is.
//
// ── THE COMPARE FUNCTION IS THE CALLER'S ─────────────────────────────
//
// Same convention as `Array.prototype.sort`: negative when `a` comes
// first. So "better" is whatever the caller says, and this file has no
// opinion about quality — which is the point, because quality is the part
// that is going to keep changing (peerSearch.js).
//
// It must be a TOTAL order, and that is the caller's burden: a compare
// that answers 0 for two different items leaves their order to insertion
// sequence, and a result that depends on which partner replied first is
// not a result anybody can page through.

// `capacity` spots, `compare(a, b)` deciding which is better.
//
// Kept as a sorted array rather than a heap. A heap is the textbook answer
// and is wrong here: at k = 32 the array insert is a handful of pointer
// moves against a heap's sift, the array gives `items()` in order for
// free where a heap needs a final sort, and — the reason that actually
// decides it — an array is readable in a debugger by somebody asking why
// a row did not make the list.
function createBucket(capacity, compare) {
  var cap = typeof capacity === 'number' && capacity > 0 ? Math.floor(capacity) : 0;
  if (typeof compare !== 'function') {
    throw new Error('createBucket needs a compare(a, b) — the bucket holds no opinion about quality');
  }

  var held = [];
  var seen = 0;
  var turnedAway = 0;

  // Where `item` belongs among the ones already held. Binary, because the
  // held list is sorted by construction and a linear scan would be the
  // one place this grows with capacity.
  function seatFor(item) {
    var lo = 0;
    var hi = held.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (compare(item, held[mid]) < 0) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  return {
    // Answers whether it got a spot. A caller that does not care can
    // ignore it; a caller streaming from several sources can use it to
    // stop asking a source that has stopped placing.
    offer: function (item) {
      seen += 1;

      // A bucket with no spots keeps nothing and says so, rather than
      // being a special case every caller has to remember.
      if (cap === 0) { turnedAway += 1; return false; }

      if (held.length < cap) {
        held.splice(seatFor(item), 0, item);
        return true;
      }

      // FULL. The only question left is whether this beats the weakest
      // spot — one compare, and for most of a million items the answer is
      // no and nothing moves.
      var weakest = held[held.length - 1];
      if (compare(item, weakest) >= 0) { turnedAway += 1; return false; }

      held.pop();
      turnedAway += 1;          // the evicted one did not make it either
      held.splice(seatFor(item), 0, item);
      return true;
    },

    // Best first. A copy, so a caller cannot sort the result again and
    // re-open the question the compare function closed.
    items: function () { return held.slice(); },

    size: function () { return held.length; },
    capacity: function () { return cap; },

    // WERE THERE MORE. Counted rather than inferred from `seen > cap`,
    // because an item can be offered and rejected without ever being a
    // candidate — and `more` means "there were results you are not
    // seeing", which is what a caller shows a person.
    more: function () { return turnedAway > 0; },

    // For a caller that wants to say how broad the question was.
    offered: function () { return seen; },
  };
}

module.exports = { createBucket: createBucket };
