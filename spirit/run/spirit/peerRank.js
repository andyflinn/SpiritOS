'use strict';
require('./spirit.js');

// spirit/run/spirit/peerRank.js
// THE PEER SEARCH'S ONE RANKER, ON THE PROBABILITY MODULES (goal/G29.17).
//
//   The item's box: "Each relay ranks its members with the probability modules and answers a capped list. The node
//   merges the relays' answers with the same modules."
//
// A relay ranks its connected members with it, and the node ranks what the relays and its memory answered with it, so
// one name scores the same wherever it is ranked. A peer is matched on the whole row as it is served (goal/G41.28,
// below), not on its label alone.
//
// rank(rows, q, slots) -> { rows, more }
//   rows   the rows offered, untouched, best match first; a row that does not match is left out
//   q      the words typed; '' or '*' is anyone, every row in the order given
//   slots  how many come back at most; more when one was turned away

var probabilityStringObjectMatch = spirit.require('spirit/probabilityStringObjectMatch.js').probabilityStringObjectMatch;
var createProbabilityBucket = spirit.require('spirit/probabilityBucket.js').createProbabilityBucket;

// How many rows one relay answers (the graded search's 32, kept).
var SLOTS = 32;

function labelOf(row) { return String((row && row.publicLabel) || ''); }

// A RANKER FED IN SLICES (goal/G41.30; the report: "A long search query stalls the relay's event loop for seconds"):
// ranker(q, slots) -> { add(rows), result() }, so a caller with many rows ranks them a page at a time and answers others
// between pages. rank() is one ranker fed once.
function ranker(q, slots) {
  var words = String(q == null ? '' : q).trim();
  var anyone = !words || words === '*';
  var room = typeof slots === 'number' && slots > 0 ? slots : SLOTS;
  var bucket = createProbabilityBucket(room);
  var i = 0;
  return {
    add: function (rows) {
      (rows || []).forEach(function (row) {
        var at = i++;
        if (!row) return;
        // A tie keeps the order the rows came in: the earlier one a hair higher.
        var tie = 1e-9 / (1 + at);
        if (anyone) { bucket.seatFor(0.5 + tie, row); return; }
        // THE ROW AS IT IS SERVED (goal/G41.28; Andy, box v15: "search the whole bloody ROW, as it is served"): the whole row the answer carries, not its label alone.
        var p = Number(probabilityStringObjectMatch(words, row)) || 0;
        if (p > 0) bucket.seatFor(Math.min(1, p * (1 - 1e-9) + tie), row);
      });
    },
    result: function () {
      var out = bucket.serialize();
      return { rows: out.items, more: !!out.more };
    },
  };
}

function rank(rows, q, slots) {
  var r = ranker(q, slots);
  r.add(rows);
  return r.result();
}

module.exports = { rank: rank, ranker: ranker, SLOTS: SLOTS };
