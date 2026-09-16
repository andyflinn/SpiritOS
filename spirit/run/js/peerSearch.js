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

// ── TOKENS ───────────────────────────────────────────────────────────
//
// Split on whitespace and the separators a name actually uses. A person
// writing "anna-marie" and a person writing "anna marie" mean the same
// two words, and a matcher that disagrees is describing punctuation.
//
// Lowercased by the callers before they get here, so this does not
// lowercase again — the query is normalised once per search, not once per
// row of a million.
function tokens(text) {
  return String(text || '').split(/[\s\-_.,/]+/).filter(function (t) { return t.length > 0; });
}

// HOW MANY CHARACTERS MATCHED, TOKEN FOR TOKEN, whole tokens only.
//
//   Andy: "break down both strings into tokens, and measure how many
//   characters are matched in case insensitive token to token comparison.
//   search string: 'one two three four' result string: 'six twelve four
//   one' — we compute the combined length of full token matches against
//   the length of the search string."
//
// A MULTISET, not a set: two tokens the same in the query need two in the
// label to both count, or "john john" would score double against one
// "john". Each label token is consumed once.
function overlapChars(queryTokens, labelTokens) {
  var pool = labelTokens.slice();
  var chars = 0;
  for (var i = 0; i < queryTokens.length; i++) {
    var at = pool.indexOf(queryTokens[i]);
    if (at === -1) continue;
    pool.splice(at, 1);
    chars += queryTokens[i].length;
  }
  return chars;
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
  if (label.indexOf(query) !== -1) return 2;

  // ── TIER 3: SOME OF THE WORDS, IN ANY ORDER ────────────────────────
  //
  // "one two three four" against "six twelve four one" is not a substring
  // of anything and used to be NO MATCH — which is why the token signal
  // below needed this before it could ever fire. Two of four words are
  // right; that is worse than finding the whole query somewhere, and much
  // better than nothing.
  //
  // ONLY FOR A MULTI-TOKEN QUERY, and that is not an optimisation for its
  // own sake: a single-token query that matches a whole token is ALWAYS
  // already a substring match, so the check could only ever cost a split
  // per row and never change an answer. A million rows is the size this
  // was built for.
  if (!/[\s\-_.,/]/.test(query)) return -1;
  return overlapChars(tokens(query), tokens(label)) > 0 ? 3 : -1;
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

// ── QUALITY IS A PROBABILITY, AND THE SIGNALS ARE WEIGHTED ───────────
//
//   Andy: "lets define quality like probability a number from 0.0 to 1.0.
//   then different approaches to quality could be weighted to come up with
//   an overall quality measurement."
//
// Every signal answers the SAME question — *how likely is this the row
// that was wanted* — on the same scale, 0.0 to 1.0, one being certain. It
// knows nothing about the others and nothing about how much it counts.
//
// WHY THIS REPLACED A PRECEDENCE LIST. The first version compared signals
// in a fixed order: rank, then presence, then nearness, each an absolute
// veto over everything below it. That is not tunable — it can only be
// REORDERED, and reordering is a cliff. Under weights, saying "presence
// matters more" is a number moving, and the effect is proportional.
//
// It also changes what a tie is. Lexicographic order almost never ties, so
// the weakest signal silently decided a great many rows. Weighted, rows
// genuinely close in quality fall through to the label — which is the
// honest answer when nothing measured tells them apart.
//
// ── THE WEIGHTS ARE THE TUNING SURFACE, AND THEY ARE GUESSES ─────────
//
// Nothing here is measured yet. Andy: "quality-of-result measurements etc.
// are up in the air." These are a starting point chosen to preserve the
// behaviour the old precedence list had, so the change of model is not
// also a change of results — and every one of them is expected to move.
//
// A signal is added as an entry, not as a line in a comparator: a name, a
// weight, and a function that reads the row and answers 0..1.
var SIGNALS = [
  // HOW WELL THE LABEL ANSWERS THE QUERY. Exact is certainty; a prefix is
  // most of the way there; found-in-the-middle is a maybe. Dominant on
  // purpose — being reachable does not make somebody the person asked for.
  {
    name: 'match',
    weight: 1.0,
    quality: function (s) {
      if (s.rank === 0) return 1.0;    // exact
      if (s.rank === 1) return 0.7;    // starts with, or an anchored pattern
      if (s.rank === 2) return 0.35;   // found somewhere
      return 0.15;                     // only some of the words, in any order
    },
  },

  // IS THERE ANYBODY THERE. A relay stores nothing (0006), so an absent
  // peer cannot be posted to at all — this is the difference between a row
  // you can act on and a row you can only file, which is why it is worth a
  // quarter of the match and not a tenth.
  //
  // Binary today. It is the obvious place for the first real measurement:
  // a live PERCENTAGE over a window is the same number with more truth in
  // it, and needs no change here beyond returning it.
  {
    name: 'present',
    weight: 0.25,
    quality: function (s) { return s.row.present ? 1.0 : 0.0; },
  },

  // HOW MUCH OF THE LABEL THE QUERY ACCOUNTS FOR — the cheap one.
  //
  //   Andy: "the [search] string length versus the result-string-length is
  //   a cheap quality tester. if the search string length exceeds the
  //   result string length, the probability that the match is valuable
  //   might be extremely low."
  //
  // Three letters found in a four-letter name is most of that name. The
  // same three in a thirty-letter name is a fragment, and the person who
  // typed them probably did not mean it. Nothing else in this list can
  // tell those apart: both are prefix matches, identical on every other
  // signal, and before this they fell through to ALPHABETICAL ORDER —
  // which is not a quality judgement, it is the absence of one.
  //
  // WILDCARDS ARE STRIPPED FIRST. `*` and `?` add length without adding
  // evidence — `*a*` is three characters matching one — so measuring them
  // would penalise a precise wildcard for its own punctuation.
  //
  // WHICH MAKES ANDY'S CASE UNREACHABLE, and that is worth writing down
  // rather than discovering twice. He asked for the query-longer-than-the
  // -label case to score very low; once the punctuation is gone it cannot
  // happen, because a glob match maps every literal character in the
  // pattern to a distinct character of the label IN ORDER — so a row that
  // matched at all has a label at least as long as the literal query.
  //
  // The ratio is still written smaller-over-larger rather than q/l. Not
  // defensive habit: `rank` is expected to change, and a future one that
  // admits a fuzzy or transposed match would make the branch live. Written
  // as a ratio it keeps meaning the same thing on that day.
  {
    name: 'coverage',
    weight: 0.2,
    quality: function (s) {
      var q = s.query.replace(/[*?]/g, '').length;
      var l = s.label.length;
      if (!q || !l) return 0;
      return q < l ? q / l : l / q;
    },
  },

  // HOW MANY OF THE WORDS LANDED.
  //
  //   Andy: "we compute the combined length of full token matches against
  //   the length of the search string... this gives us a measurement of
  //   how many characters are matched in separate tokens as percentage,
  //   expressable in a value from 0 to 1."
  //
  // WHY IT IS NOT REDUNDANT WITH `coverage`, which is the obvious
  // objection. Coverage compares STRING LENGTHS and is blind to order and
  // to words: "one two three four" against "six twelve four one" is 18
  // characters against 19, so coverage calls it 0.95 — nearly perfect —
  // while only half the words are actually right. This reads the words.
  //
  // THE DENOMINATOR IS THE QUERY. Andy offered either; they are the two
  // halves of the same pair and they answer different questions —
  //
  //   over the query   how much of what I TYPED was found   (recall)
  //   over the label   how much of the NAME I accounted for (precision)
  //
  // and `coverage` already approximates the second. So this takes the
  // first, and the two signals together carry both sides with separate
  // weights, which is the whole reason the model is weighted.
  {
    name: 'tokens',
    weight: 0.3,
    quality: function (s) {
      var q = tokens(s.query.replace(/[*?]/g, ' '));
      if (!q.length) return 0;
      var typed = q.reduce(function (n, t) { return n + t.length; }, 0);
      if (!typed) return 0;
      return overlapChars(q, tokens(s.label)) / typed;
    },
  },

  // HOW NEAR. `via` null means the caller's own members; anything else came
  // from a partner. Acquiring needs a census this node can reach, and the
  // nearer one is reachable without a partnership — the rule `harvest`
  // already follows in hub.js. Lightest of the three: it is about cost,
  // not about whether the row is the right one.
  {
    name: 'near',
    weight: 0.15,
    quality: function (s) { return s.row.via == null ? 1.0 : 0.0; },
  },
];

// The weighted mean — 0.0 to 1.0, so the total reads on the same scale as
// the parts and a caller can show it to a person without explaining it.
//
// Normalised by the weights actually present, so adding a signal does not
// silently rescale every score that came before it.
function quality(s) {
  var sum = 0;
  var total = 0;
  for (var i = 0; i < SIGNALS.length; i++) {
    var w = SIGNALS[i].weight;
    if (!(w > 0)) continue;
    var q = SIGNALS[i].quality(s);
    // A signal that answers nonsense is clamped rather than allowed to
    // dominate: 0..1 is the contract, and a bug in one signal must not be
    // able to reorder everything.
    if (!(q >= 0)) q = 0;
    if (q > 1) q = 1;
    sum += w * q;
    total += w;
  }
  return total > 0 ? sum / total : 0;
}

// ── THE COMPARE FUNCTION ─────────────────────────────────────────────
//
// Same convention as `Array.prototype.sort`: negative when `a` comes
// first. Higher quality first, so the subtraction is the other way round.
//
// TOTAL, and that is not a nicety. A comparator answering 0 for two
// different rows leaves them to insertion order — and a search whose
// second page depends on which partner replied first is not a search
// anybody can page through. Under weights this matters MORE than it did
// under a precedence list, because equal scores are now common: two rows
// can differ in their signals and still add up the same.
function compare(a, b) {
  var qa = quality(a);
  var qb = quality(b);
  if (qa !== qb) return qb - qa;
  var byLabel = a.label.localeCompare(b.label);
  if (byLabel !== 0) return byLabel;
  return String(a.row.publicKey).localeCompare(String(b.row.publicKey));
}

// WHY A ROW SCORED WHAT IT SCORED. Not used by the search — it exists so a
// weight can be argued about with numbers instead of impressions, and so
// the day somebody asks "why is that one third" there is an answer that
// does not require reading this file.
function explain(row, query) {
  var q = String(query == null ? '' : query).toLowerCase();
  var label = String((row && row.publicLabel) || '').toLowerCase();
  var s = { row: row || {}, label: label, rank: rank(label, q), query: q };
  if (s.rank < 0) return { matched: false, quality: 0, signals: [] };
  return {
    matched: true,
    quality: quality(s),
    signals: SIGNALS.map(function (sig) {
      return {
        name: sig.name,
        weight: sig.weight,
        quality: sig.quality(s),
        contribution: sig.weight * sig.quality(s),
      };
    }),
  };
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

  return bucketIn.offer({ row: copy, label: label, rank: r, query: q });
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
  tokens: tokens,
  overlapChars: overlapChars,
  rank: rank,
  quality: quality,
  compare: compare,
  explain: explain,
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
