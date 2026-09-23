'use strict';

// spirit/run/js/peerSearch.js
// WHAT A PEER SEARCH KNOWS THAT A SEARCH DOES NOT.
//
//   Andy: "lets assume that the search logic will not only be applied to
//   peer-objects, but to a uniformly shaped set of objects: the interface
//   only needs to supply a means of extracting the relevant comparison
//   string from the object, so the bucket doesn't have to know the shape
//   of the object."
//
// So this file is the whole of "peer" in peer search, and it is short on
// purpose. Three layers, each ignorant of the one above it:
//
//   js/bucket.js        limited spots, weakest evicted, takes a compare.
//                       Knows nothing at all. Grades numbers in its suite.
//
//   js/gradedSearch.js  what makes one STRING a better answer than another
//                       for a query: exact over prefix over anywhere over
//                       scattered words, how much of the name was typed,
//                       how many words landed, whether they were in order.
//                       Knows strings. Does not know what an object is.
//
//   this file           the extractor — which string on a peer row is the
//                       one to match — and the two signals that read the
//                       ROW rather than its label.
//
// WHAT THAT BUYS, beyond tidiness. The next thing worth searching is not a
// peer: it is processes by label and description (Job Selector already
// filters a list by hand), apps, files, log entries, relays. Each needs a
// line of extractor and whatever signals are true of ITS objects, and
// inherits every word of the matching without being able to disagree with
// it — which is the disagreement that would otherwise arrive as "search
// works differently in the Files app".

var gradedSearch = require('./gradedSearch');

// ── WHAT A PEER IS MATCHED ON ────────────────────────────────────────
//
// The public label, and nothing else. Not the key: a key is not something
// a person types or recognises, and the six characters they DO read are a
// telephone affordance rather than a search term (UI_DESIGN_STYLE §6).
function textOf(peer) {
  return (peer && peer.publicLabel) || '';
}

// Identity, for de-duplication across sources and as the last tiebreak.
// A peer IS its key — decision 0003 — so this is not a choice.
function idOf(peer) {
  return (peer && peer.publicKey) || '';
}

// ── WHAT IS TRUE OF A PEER AND NOT OF A STRING ───────────────────────
//
// These read `s.item`, which is the row the caller offered, untouched.
// Everything about the label is gradedSearch's and is not repeated here.
var PEER_SIGNALS = [
  // `present` STOOD HERE, a quarter of the match: "is there anybody there".
  // Moot since 2026-09-19 — a relay answers a search from its connected
  // members only (Andy: "search should respond with active/online members
  // only"), so every row offered is present and the signal told nothing
  // apart. A live percentage over a window, the measurement it was waiting
  // for, would come back here as a new signal with a new name.

  // HOW NEAR. `via` null means the caller's own members; anything else came
  // from a partner. Acquiring needs a roll this node can reach, and the
  // nearer one is reachable without a partnership — the rule `harvest`
  // already follows in hub.js. Lightest of the signals: it is about cost,
  // not about whether the row is the right one.
  {
    name: 'near',
    weight: 0.15,
    quality: function (s) {
      return s.item && s.item.via == null ? 1.0 : 0.0;
    },
  },
];

function optionsFor(slots) {
  return {
    text: textOf,
    id: idOf,
    signals: PEER_SIGNALS,
    slots: typeof slots === 'number' && slots > 0 ? slots : gradedSearch.SLOTS,
  };
}

// ── THE SAME THREE CALLS, IN PEER TERMS ──────────────────────────────
//
// Answers rows rather than the `{item, tag, quality}` gradedSearch hands
// back, because every caller in the tree wants the row: relay.js puts it
// straight on the wire. `via` is stamped from the tag, so a row remembers
// which partner supplied it without anybody keeping a parallel list.

function rowsFrom(result) {
  return {
    matches: result.matches.map(function (m) {
      if (m.tag === undefined) return m.item;
      var copy = {};
      Object.keys(m.item).forEach(function (k) { copy[k] = m.item[k]; });
      copy.via = m.tag;
      // EVERY RELAY THIS PEER WAS FOUND ON, not only the best-ranked one.
      // The fan-out paid for all of them; `via` keeps its old meaning
      // (the source of the row that won) and `vias` carries the rest, so
      // a reader that wants one route is unchanged and a reader that
      // wants a routing table has one.
      if (m.tags && m.tags.length > 1) copy.vias = m.tags.slice();
      return copy;
    }),
    more: result.more,
  };
}

// A bucket to drop candidates into. The caller offers rows and reads the
// result; nothing about matching, weighting or eviction is visible.
function open(query, slots) {
  var b = gradedSearch.open(query, optionsFor(slots));
  return {
    offer: function (row, via) { return b.offer(row, via); },
    result: function () { return rowsFrom(b.result()); },
  };
}

function search(rows, query, slots) {
  var b = open(query, slots);
  (rows || []).forEach(function (row) { b.offer(row); });
  return b.result();
}

// Each source is `{ via, rows }` — `via` null for this node's own members.
// `maxBytes` is the wire's ceiling, and the caller supplies it because the
// caller is the one that knows what envelope this answer goes into. The
// ranking decides WHICH rows; the ceiling decides how many of them fit,
// and neither question is answered in relay.js any more.
function merge(sources, query, slots, maxBytes) {
  var opts = optionsFor(slots);
  if (typeof maxBytes === 'number' && maxBytes > 0) {
    opts.maxBytes = maxBytes;
    // What a row costs is what a row IS on the wire, which is this
    // module's business rather than the bucket's.
    opts.wire = function (m) {
      var row = {};
      Object.keys(m.item).forEach(function (k) { row[k] = m.item[k]; });
      if (m.tag !== undefined) row.via = m.tag;
      if (m.tags && m.tags.length > 1) row.vias = m.tags.slice();
      return row;
    };
  }
  return rowsFrom(gradedSearch.merge(
    (sources || []).map(function (source) {
      return { tag: source && source.via == null ? null : source.via, items: (source && source.rows) || [] };
    }),
    query, opts));
}

// Why a row scored what it scored, in peer terms. Not used by the search:
// it exists so a weight can be argued about with numbers.
function explain(row, query) {
  return gradedSearch.explain(row, query, optionsFor());
}

module.exports = {
  open: open,
  search: search,
  merge: merge,
  explain: explain,
  // The tuning surface is the whole list, both halves of it: what is true
  // of a string and what is true of a peer are weighed against each other.
  SIGNALS: gradedSearch.TEXT_SIGNALS.concat(PEER_SIGNALS),
  PEER_SIGNALS: PEER_SIGNALS,
  SLOTS: gradedSearch.SLOTS,
};
