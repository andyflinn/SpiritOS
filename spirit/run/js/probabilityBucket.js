'use strict';

// ONE SCOPE OF ITS OWN (goal/G27.14): loaded into a page as a plain script, its names stay its own.
(function () {

// spirit/run/js/probabilityBucket.js
// THE BEST OBJECTS BY PROBABILITY, SEATED AS THEY COME AND SERIALIZED TO A CEILING — goal/G18.4, the third of the
// probabilit* modules.
//
//   Andy, 2026-10-12: "like bucket.js ... 1. function createProbabilityBucket(capacity) 2. seatFor(probability,
//   item)"; "objecs are simply dropped into the the probabilityBucket with their probability, and probabilityBucket
//   sorts that into it's table all by itself."; "The Bucket knows NOTHING about string matching, it will only know how
//   to sort-add objects by probability. internally its table carries objects like this: { probability, object } the
//   serialize will only serialize and measure the object portion of its array-entries."; "the bucket fills up with
//   objects of probability 0, until those objects are pushed out by higher-probability objects."; and "the ONLY job of
//   probabilityBucket is inserting by highest-probability at the top, and limiting the serialized object, this way the
//   bucket needs no compare-callback, nothing. and the whole system is simpler,".
//
// HOW IT IS USED (his example, the integration argued after): "the desk reads items, newest to oldest, up to
// MAX_SCANNED_ITEMS, compares every item against the search string, gets a probability as result, then drops the
// (probability,item) combination into the bucket. at the end calls serialize, done." Whatever else a caller weighs
// (the peer search's presence and nearness) it folds into the probability before seatFor.
//
// NO I/O, NO CLOCK, NO REQUIRE: an array, a capacity and two functions.

// THE BYTES, NOT THE CHARACTERS (Andy, 2026-10-10: every size check in bytes, never .length): UTF-8, in node and in a
// page alike.
function utf8Bytes(text) { return unescape(encodeURIComponent(String(text))).length; }

function scored(probability) { return typeof probability === 'number' && probability >= 0 && probability <= 1; }

function createProbabilityBucket(capacity) {
  var cap = typeof capacity === 'number' && capacity > 0 ? Math.floor(capacity) : 0;
  var table = [];          // { probability, object }, highest first
  var turnedAway = 0;

  return {
    // SEATED BY PROBABILITY: highest at the top, an equal one behind those already in. Full, the lowest goes when a
    // higher one comes, and a lower or equal one is turned away. Answers whether it got a seat. A probability is a
    // number from 0 to 1; anything else gets none.
    seatFor: function (probability, object) {
      if (typeof probability !== 'number' || !(probability >= 0 && probability <= 1)) { turnedAway += 1; return false; }
      if (cap === 0) { turnedAway += 1; return false; }
      if (table.length >= cap && !(probability > table[table.length - 1].probability)) { turnedAway += 1; return false; }
      var at = table.length;
      while (at > 0 && table[at - 1].probability < probability) at -= 1;
      table.splice(at, 0, { probability: probability, object: object });
      if (table.length > cap) { table.pop(); turnedAway += 1; }
      return true;
    },

    // THE OBJECTS ALONE, BEST FIRST, through map, measured in bytes against the ceiling; stopping at the first that
    // will not fit, never skipping it for a smaller one further down (the order is the probability's). `more` when
    // something was turned away or cut; `truncated` when cut. UNBOUNDED BY DEFAULT (goal/G27.14, Andy, 2026-10-17: "in
    // probabilityBucket.js use serialize: function (map, maxBytes = 0) where 0 means unbounded."): a caller that sends
    // nothing over the wire, as a page ranking its own cache, leaves maxBytes out; with a bucket made with Infinity it
    // gets every object seated.
    serialize: function (map, maxBytes = 0) {
      var toWire = typeof map === 'function' ? map : function (x) { return x; };
      var ceiling = typeof maxBytes === 'number' && maxBytes > 0 ? maxBytes : 0;
      var out = [];
      var cut = false;
      for (var i = 0; i < table.length; i += 1) {
        if (!scored(table[i].probability)) continue;
        var row = toWire(table[i].object);
        if (ceiling && utf8Bytes(JSON.stringify(out.concat([row]))) > ceiling) { cut = true; break; }
        out.push(row);
      }
      return { items: out, bytes: utf8Bytes(JSON.stringify(out)), more: turnedAway > 0 || cut, truncated: cut };
    },

    // RE-SORTED BY THE CALLER'S FUNCTION (goal/G27.14, Andy, 2026-10-17: "sort("search string") this way the bucket
    // itself can be the cache needed in shell apps.", then "SORT(probability = compareFunction())"): every held object
    // gets compare(object) as its new probability, highest first, an equal one keeping its place. The bucket still
    // knows nothing of strings; the function does. One scored outside 0 to 1 stays held, left out of serialize until a
    // later sort scores it again.
    sort: function (compare) {
      if (typeof compare !== 'function') return;
      table = table.map(function (x, at) { var p = compare(x.object); return { probability: scored(p) ? p : -1, object: x.object, at: at }; })
        .sort(function (a, b) { return b.probability - a.probability || a.at - b.at; })
        .map(function (x) { return { probability: x.probability, object: x.object }; });
    },
  };
}

// IN NODE AND IN A PAGE ALIKE (goal/G27.14), as probabilityStringMatch.js: a page finds it on window.spiritProbability.
if (typeof module !== 'undefined' && module && module.exports) module.exports = { createProbabilityBucket: createProbabilityBucket };
if (typeof window !== 'undefined' && window) {
  window.spiritProbability = window.spiritProbability || {};
  window.spiritProbability.createProbabilityBucket = createProbabilityBucket;
}
}());
