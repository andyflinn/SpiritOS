'use strict';

// spirit/run/js/peerRank.js
// THE PEER SEARCH'S ONE RANKER, ON THE PROBABILITY MODULES (goal/G29.17).
//
//   The item's box: "Each relay ranks its members with the probability modules and answers a capped list; the old
//   graded search (peerSearch.js, gradedSearch.js) goes. The node merges the relays' answers with the same modules."
//
// A relay ranks its connected members with it, and the node ranks what the relays and its memory answered with it, so
// one name scores the same wherever it is ranked. A peer is matched on its public label and nothing else: a key is
// not something a person types.
//
// rank(rows, q, slots) -> { rows, more }
//   rows   the rows offered, untouched, best match first; a row whose label does not match is left out
//   q      the words typed; '' or '*' is anyone, every row in the order given
//   slots  how many come back at most; more when one was turned away

var probabilityStringObjectMatch = require('./probabilityStringObjectMatch').probabilityStringObjectMatch;
var createProbabilityBucket = require('./probabilityBucket').createProbabilityBucket;

// How many rows one relay answers (the graded search's 32, kept).
var SLOTS = 32;

function labelOf(row) { return String((row && row.publicLabel) || ''); }

function rank(rows, q, slots) {
  var words = String(q == null ? '' : q).trim();
  var anyone = !words || words === '*';
  var room = typeof slots === 'number' && slots > 0 ? slots : SLOTS;
  var bucket = createProbabilityBucket(room);
  (rows || []).forEach(function (row, i) {
    if (!row) return;
    // A tie keeps the order the rows came in: the earlier one a hair higher.
    var tie = 1e-9 / (1 + i);
    if (anyone) { bucket.seatFor(0.5 + tie, row); return; }
    var p = Number(probabilityStringObjectMatch(words, { name: labelOf(row) })) || 0;
    if (p > 0) bucket.seatFor(Math.min(1, p * (1 - 1e-9) + tie), row);
  });
  var out = bucket.serialize();
  return { rows: out.items, more: !!out.more };
}

module.exports = { rank: rank, SLOTS: SLOTS };
