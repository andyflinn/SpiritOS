'use strict';
if (typeof require === 'function') require('./spirit.js'); // node only: a page has the global spirit already, and no require

// ONE SCOPE OF ITS OWN (goal/G27.14): loaded into a page as a plain script, its names stay its own.
(function () {

// spirit/run/spirit/listLimiter.js
// THE BEST OBJECTS BY PROBABILITY, SEATED AS THEY COME AND SERIALIZED TO A CEILING — goal/G18.4, the third of the
// probabilit* modules.
//
//   Andy, 2026-10-12: "1. function createProbabilityBucket(capacity) 2. seatFor(probability, item)"; "objecs are simply dropped into the the probabilityBucket with their probability, and probabilityBucket
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

// ITS ONE LIMIT IS BYTES (goal/G49.8, box v12; Andy: "Disregard the seatlimit, because its DUMB", "limiting by row count is
// wasteful on the wire, the actual byte size of each row is a variable"): capacity is the byte size of what it holds,
// measured as serialize measures it (the objects as one JSON array), kept as a running total, each object measured once as
// it is seated. Infinity holds everything.
function createProbabilityBucket(capacity) {
  var cap = typeof capacity === 'number' && capacity > 0 ? (capacity === Infinity ? Infinity : Math.floor(capacity)) : 0;
  var table = [];          // { probability, object, bytes }, highest first, equals in arrival order
  var turnedAway = 0;
  var held = 0;            // the objects' own bytes, summed
  function size() { return table.length ? 2 + held + (table.length - 1) : 2; }

  return {
    // SEATED BY PROBABILITY: highest at the top, an equal one behind those already in. Past the byte limit the longest
    // held of the lowest goes, at once, until what it holds fits (Andy: "for some apps, the data.js will say, age
    // determines shedding ... the bucket doesn't care"): so a newcomer of equal probability takes the room of the longest
    // held of them, a higher one the room of the lowest, and a lower one is turned away. Answers false when the object
    // got no seat, else the objects it pushed out to make room (an empty array when none). A probability is a number
    // from 0 to 1; anything else gets none.
    seatFor: function (probability, object) {
      if (typeof probability !== 'number' || !(probability >= 0 && probability <= 1)) { turnedAway += 1; return false; }
      if (cap === 0) { turnedAway += 1; return false; }
      // With no limit nothing is measured: a page seats every row of its lists in an Infinity bucket, and measuring each
      // write is what slowed the shell (goal/G49.8, twice).
      var bytes = cap === Infinity ? 0 : utf8Bytes(JSON.stringify(object) === undefined ? 'null' : JSON.stringify(object));
      var entry = { probability: probability, object: object, bytes: bytes };
      var at = table.length;
      while (at > 0 && table[at - 1].probability < probability) at -= 1;
      table.splice(at, 0, entry);
      held += bytes;
      var out = [];
      var seated = true;
      while (cap !== Infinity && table.length && size() > cap) {
        // The lowest probability is at the end; the longest held of it is the first of that run.
        var low = table[table.length - 1].probability;
        var first = table.length - 1;
        while (first > 0 && table[first - 1].probability === low) first -= 1;
        var gone = table.splice(first, 1)[0];
        held -= gone.bytes;
        turnedAway += 1;
        if (gone === entry) seated = false; else out.push(gone.object);
      }
      return seated ? out : false;
    },

    // THE OBJECTS ALONE, BEST FIRST, through map, measured in bytes against the ceiling; stopping at the first that
    // will not fit, never skipping it for a smaller one further down (the order is the probability's). `more` when
    // something was turned away or cut; `truncated` when cut. UNBOUNDED BY DEFAULT (goal/G27.14, Andy, 2026-10-17: "in
    // listLimiter.js use serialize: function (map, maxBytes = 0) where 0 means unbounded."): a caller that sends
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
      table = table.map(function (x, at) { var p = compare(x.object); return { probability: scored(p) ? p : -1, object: x.object, bytes: x.bytes, at: at }; })
        .sort(function (a, b) { return b.probability - a.probability || a.at - b.at; })
        .map(function (x) { return { probability: x.probability, object: x.object, bytes: x.bytes }; });
    },
  };
}

// IN NODE AND IN A PAGE ALIKE (goal/G27.14), as spirit/search/string.js: a page finds it at spirit.required.spirit.listLimiter.
if (typeof module !== 'undefined' && module && module.exports) module.exports = { createProbabilityBucket: createProbabilityBucket };
if (typeof window !== 'undefined' && window) {
  // ONE PLACE, spirit.required.<its path> (goal/G49.4; Andy: "spirit.requireScript() places the loaded script at the exact same
  // motherfucking location/path in the spirit object"): on a page as in node, where the loader finds it.
  var R = ((window.spirit = window.spirit || {}).required = window.spirit.required || {});
  (R.spirit = R.spirit || {}).listLimiter = { createProbabilityBucket: createProbabilityBucket };
}
}());
