'use strict';

// spirit/run/js/peerSearch.js
// HOW GOOD A MATCH IS, AND WHICH ONES FIT — on its own, on purpose.
//
//   Andy: "the search prioritized result needs to be a whole module, with
//   a boundary that i have test ideas for."
//   Andy: "i want the graded search logic and that stuff isolated from
//   relay or other core components, since quality-of-result measurements
//   etc. are up in the air and we need to have this block separately
//   tested and verified, and give it an independent evolution path."
//
// ── WHAT ISOLATION MEANS HERE, PRECISELY ─────────────────────────────
//
// Not "a separate file". Three properties, each of which a later change
// could quietly cost:
//
//   1. NO I/O, NO CLOCK, NO NETWORK, NO RELAY. Every input arrives as an
//      argument. There is nothing to stand up in order to drive this, so
//      a quality question can be settled by a test rather than by a lab.
//      The one require is js/bucket.js, which is a data structure and has
//      no opinion about peers, quality or anything else.
//
//   2. NO RELAY TYPES CROSS THE BOUNDARY. A caller hands over plain rows
//      — `{ publicKey, publicLabel, present, via }` — and gets rows back.
//      relay.js maps its own `peers` into that shape before calling in.
//      So the ranking can change completely without relay.js changing at
//      all, which IS the independent evolution path.
//
//   3. PRESENCE IS A FIELD, NEVER A LOOKUP. `presentNow.isPresent` is a
//      relay concept and a live one; taking it as a function here would
//      drag the relay's clock and socket state in through the back door,
//      and make every ranking test stand up a registry to answer it.
//
// ── THE SCORING IS THE PART THAT IS UP IN THE AIR ────────────────────
//
// `rank` grades one row; `SIGNALS` names what `compare` weighs and in
// what sequence. Today that is rank, then presence, then nearness. When a
// quality-of-result measurement arrives — activity, live percentage, how
// often somebody actually answered — it is an entry in SIGNALS with its
// own check, and nothing above or below it moves.
//
// THE BUCKET IS NOT THIS FILE'S EITHER. js/bucket.js holds `slots` items
// and evicts the weakest, and takes `compare` the way sort() does — so the
// mechanism and the opinion evolve apart. Andy: "the mechanism itself
// needs to be supplied with a compare function, similar to sort()."
//
// What must NOT happen is a second opinion forming somewhere else: a
// caller that sorts the output again has re-opened the question this
// module exists to close.

var bucket = require('./bucket');

// ── WILDCARDS, WITHOUT HANDING A STRANGER A REGEX ────────────────────
//
//   Andy: "the search must be supporting wildcards etc."
//
// `*` any run, `?` one character. NOT compiled to a RegExp: a pattern a
// stranger supplies, turned into a regex, is catastrophic backtracking
// waiting to be typed — `*a*a*a*a*b` against a long label is the classic,
// and it would be a public relay burning CPU on request.
//
// So the matcher is the two-pointer one, which backtracks only to the
// last `*` and is O(label × pattern) with no pathological case. Labels
// cap at 256 bytes (labelRule), so the worst case is small and knowable
// rather than merely unlikely.
function globMatches(text, pattern) {
  var t = 0;
  var p = 0;
  var star = -1;
  var mark = 0;
  while (t < text.length) {
    if (p < pattern.length && (pattern[p] === '?' || pattern[p] === text[t])) {
      t += 1; p += 1;
    } else if (p < pattern.length && pattern[p] === '*') {
      star = p; mark = t; p += 1;
    } else if (star !== -1) {
      p = star + 1; mark += 1; t = mark;
    } else {
      return false;
    }
  }
  while (p < pattern.length && pattern[p] === '*') p += 1;
  return p === pattern.length;
}

// How good a match is, lowest is best. A plain query still means
// "anywhere", which is what somebody typing three letters expects — the
// wildcards are for when they want to say something more precise.
//
//   0  exact
//   1  starts with
//   2  found somewhere
//  -1  no
//
// NO FLOOR ON QUERY LENGTH. Andy: "Searches for 'a' must be successful,
// even if there's a million potential peers." One letter is a legitimate
// question; the answer to a broad one is the CAP, not a refusal.
function rank(label, query) {
  if (query.indexOf('*') !== -1 || query.indexOf('?') !== -1) {
    if (!globMatches(label, query)) return -1;
    // An anchored pattern is a stronger statement than a floating one.
    return query[0] === '*' ? 2 : 1;
  }
  if (label === query) return 0;
  if (label.indexOf(query) === 0) return 1;
  return label.indexOf(query) !== -1 ? 2 : -1;
}

// ── THE SLOTS ────────────────────────────────────────────────────────
//
//   Andy: "there's just a fixed number of slots."
//
// The number is checkable rather than chosen. A row is at most a 60-char
// key, a 256-byte label (labelRule), an ISO date and two booleans, with
// field names — 418 bytes measured. The budget is PAYLOAD_MAX less a
// reply's own envelope, 16266. So 32 slots is 13376 worst case, with 2890
// spare — and that slack is there so adding a field to a row later is a
// decision rather than an incident.
//
// An earlier version measured each row and filled the packet to the byte,
// which got 91 rows of ordinary labels into the space that guarantees 37.
// Not worth the machinery: a caller wants to know what a page IS, and
// "somewhere between 37 and 96 depending on how long everyone's name is"
// is not an answer anybody can write code against.
var SLOTS = 32;

// ── WHAT ORDER COMPARES, IN ORDER ────────────────────────────────────
//
// Named rather than inlined so the sequence is a thing a test can read
// and a later signal is an entry here rather than a line buried in a
// comparator. Each takes a scored row and answers a number, lowest first.
var SIGNALS = [
  // Exact beats prefix beats anywhere, which is what a person means by a
  // better match.
  { name: 'rank', of: function (s) { return s.rank; } },

  // PRESENT BEATS ABSENT, and it is not a nicety: a relay stores nothing,
  // so an absent peer cannot be posted to at all. Liveness is the
  // difference between a row you can act on and a row you can only file —
  // not a hint about who is likelier to reply.
  { name: 'present', of: function (s) { return s.row.present ? 0 : 1; } },

  // NEARER SOURCE WINS. `via` null means the caller's own members; a
  // number is an index into whatever table the caller keeps. Acquiring
  // needs a census that lists the key, and the nearer one is reachable
  // without a partnership — the rule `harvest` already follows in hub.js.
  { name: 'near', of: function (s) { return s.row.via == null ? 0 : 1; } },
];

// ── THE COMPARE FUNCTION, WHICH IS THE WHOLE OPINION ─────────────────
//
// Same convention as `Array.prototype.sort`: negative when `a` comes
// first. SIGNALS in sequence, then the label, then the key.
//
// TOTAL, and that is not a nicety. A comparator answering 0 for two
// different rows leaves them to insertion order — and a search whose
// second page depends on which partner replied first is not a search
// anybody can page through. The key is the last resort because it is
// unique by definition.
function compare(a, b) {
  for (var i = 0; i < SIGNALS.length; i++) {
    var av = SIGNALS[i].of(a);
    var bv = SIGNALS[i].of(b);
    if (av !== bv) return av - bv;
  }
  var byLabel = a.label.localeCompare(b.label);
  if (byLabel !== 0) return byLabel;
  return String(a.row.publicKey).localeCompare(String(b.row.publicKey));
}

// ── ONE ROW, GRADED AND OFFERED ──────────────────────────────────────
//
// The stream half. A caller with a million rows never builds a list of
// them: it makes a bucket and offers, and the bucket holds `slots`.
// Answers whether the row took a spot.
function offer(bucketIn, row, query, via) {
  if (!row || !row.publicKey) return false;
  var q = String(query == null ? '' : query).toLowerCase();
  var label = String(row.publicLabel || '').toLowerCase();
  var r = rank(label, q);
  if (r < 0) return false;

  // `via` is stamped on a COPY. A caller's rows are its own, and a merge
  // that wrote back into its inputs would be a caller's list quietly
  // changing under it.
  var copy = {};
  Object.keys(row).forEach(function (k) { copy[k] = row[k]; });
  if (via !== undefined) copy.via = via;

  return bucketIn.offer({ row: copy, label: label, rank: r });
}

// A bucket ready to be offered rows, with this module's opinion in it.
function open(slots) {
  return bucket.createBucket(
    typeof slots === 'number' && slots > 0 ? slots : SLOTS, compare);
}

// What a bucket holds, as rows — the wrapper this module put around them
// on the way in is not the caller's business on the way out.
function harvest(bucketIn) {
  return {
    matches: bucketIn.items().map(function (s) { return s.row; }),
    more: bucketIn.more(),
  };
}

// ── THE CONVENIENCES, OVER THE SAME MECHANISM ────────────────────────
//
// `search` is one source and `merge` is several, and neither is a second
// implementation: both open one bucket and offer into it, so a cap across
// a merge is not a thing anybody has to remember to apply.

function search(rows, query, slots) {
  var b = open(slots);
  (rows || []).forEach(function (row) { offer(b, row, query, undefined); });
  return harvest(b);
}

// Each source is `{ via, rows }` — `via` null for the caller's own,
// otherwise whatever handle the caller uses for that source.
//
// IT DOES NOT TRUST THE ORDER IT IS GIVEN. A partner ranked its own reply
// with its own copy of this file, at whatever version it is running.
// Nothing here reads that order: every row is graded again from its label,
// which is also the only way a cap across the merged set means anything.
//
// DE-DUPLICATED BY KEY, the better copy winning — so the `near` signal
// decides which copy of a peer survives rather than which partner
// happened to answer first. Done on the way out rather than the way in,
// because a duplicate that would not have made the list is not worth a
// lookup per offer.
function merge(sources, query, slots) {
  var n = typeof slots === 'number' && slots > 0 ? slots : SLOTS;

  // Room for duplicates, or a peer on three partners could push a
  // distinct row out of a bucket it had earned a spot in.
  var b = open(n * ((sources && sources.length) || 1));
  (sources || []).forEach(function (source) {
    if (!source) return;
    var via = source.via == null ? null : source.via;
    (source.rows || []).forEach(function (row) { offer(b, row, query, via); });
  });

  var seen = Object.create(null);
  var unique = [];
  b.items().forEach(function (s) {
    if (seen[s.row.publicKey]) return;
    seen[s.row.publicKey] = true;
    unique.push(s.row);
  });

  return {
    matches: unique.slice(0, n),
    more: b.more() || unique.length > n,
  };
}

module.exports = {
  globMatches: globMatches,
  rank: rank,
  compare: compare,
  // The streaming face: open a bucket, offer rows one at a time, harvest.
  open: open,
  offer: offer,
  harvest: harvest,
  // The convenient face, over exactly the same mechanism.
  search: search,
  merge: merge,
  SIGNALS: SIGNALS,
  SLOTS: SLOTS,
};
