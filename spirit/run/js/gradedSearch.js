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
// `rank` grades one row; `TEXT_SIGNALS` names what `compare` weighs and in
// what sequence. Today that is rank, then presence, then nearness. When a
// quality-of-result measurement arrives — activity, live percentage, how
// often somebody actually answered — it is an entry in TEXT_SIGNALS with its
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
var SEPARATORS = /[\s\-_.,/]/;

function tokens(text) {
  return String(text || '').split(/[\s\-_.,/]+/).filter(function (t) { return t.length > 0; });
}

// ── ONE TOKEN AGAINST ONE TOKEN, GRADED ──────────────────────────────
//
//   Andy: "if the result token is shorter, its obviously no match; if the
//   tokens are same that token's weight is 1.0; if the result token is
//   longer, then the length of the longest matching substring compared to
//   the length of the result-token determines its weight, and the matched
//   length is added to the final length match at a reduced number."
//
// So a query word is worth its own length when it IS the result word, and
// a fraction of that when it is merely inside a longer one — the fraction
// being how much of the result word it accounts for. `ann` is all of
// `ann` and three sevenths of `annabel`, so it scores 3 against
// 3 × 3/7 = 1.29.
//
// SHORTER MEANS NO. You typed more than the word has; that is not a
// partial match, it is a different word.
//
// This is the same coverage idea as the whole-string signal below, moved
// to where it belongs. A name is words, and discounting the whole string
// by its total length says nothing about whether the RIGHT words are in
// it — which is the interaction that made "six twelve four one" outscore
// "four one" for the query "one two three four".
function tokenScore(queryToken, resultToken) {
  if (resultToken.length < queryToken.length) return 0;
  if (resultToken === queryToken) return queryToken.length;
  var run = longestRun(queryToken, resultToken);
  if (!run) return 0;
  return run * (run / resultToken.length);
}

// The longest run of characters the two share. Rolling two rows rather
// than a full table: tokens are short, but this runs per query-token per
// result-token per ROW, and a million rows is the size this was built for.
function longestRun(a, b) {
  var prev = new Array(b.length + 1).fill(0);
  var cur = new Array(b.length + 1).fill(0);
  var best = 0;
  for (var i = 1; i <= a.length; i++) {
    for (var j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : 0;
      if (cur[j] > best) best = cur[j];
    }
    var swap = prev; prev = cur; cur = swap;
    cur.fill(0);
  }
  return best;
}

// HOW MANY CHARACTERS MATCHED, taking each query word's best result word.
//
// A MULTISET, not a set: two tokens the same in the query need two in the
// label to both count, or "john john" would score double against one
// "john". Each result token is consumed by at most one query token.
//
// TWO PASSES, AND THE ORDER IS THE WHOLE CORRECTNESS OF IT.
//
// Exact matches are taken FIRST, across every query token, before any
// partial credit is handed out. One pass in query order is wrong in a way
// that is easy to miss and badly wrong when it bites: for the query
// "one two three four" against "four one", `two` scored 0.25 against
// `four` on a shared "o", consumed it, and the exact `four` that followed
// found an empty pool. Two of four words right scored as one.
//
// Within the second pass it is greedy, best available first. The optimal
// assignment is a matching problem; at four words against four it would
// cost more to be exact than the difference could ever be worth, and what
// this feeds is a ranking rather than a ledger.
//
// ANSWERS WHERE THE WORDS LANDED, not only how many characters did. The
// positions are what the sequence signal reads — see below.
function matchTokens(queryTokens, labelTokens) {
  var taken = new Array(labelTokens.length).fill(false);
  var chars = 0;
  var order = [];
  var left = [];

  // PASS ONE: whole words. Nothing may take these.
  for (var i = 0; i < queryTokens.length; i++) {
    var at = -1;
    for (var j = 0; j < labelTokens.length; j++) {
      if (!taken[j] && labelTokens[j] === queryTokens[i]) { at = j; break; }
    }
    if (at === -1) { left.push(queryTokens[i]); continue; }
    taken[at] = true;
    chars += queryTokens[i].length;
    order.push(at);
  }

  // PASS TWO: what is left, against what is left.
  for (var k = 0; k < left.length; k++) {
    var bestAt = -1;
    var bestScore = 0;
    for (var m = 0; m < labelTokens.length; m++) {
      if (taken[m]) continue;
      var sc = tokenScore(left[k], labelTokens[m]);
      if (sc > bestScore) { bestScore = sc; bestAt = m; }
    }
    if (bestAt === -1) continue;
    taken[bestAt] = true;
    chars += bestScore;
    order.push(bestAt);
  }

  return { chars: chars, order: order };
}

function overlapChars(queryTokens, labelTokens) {
  return matchTokens(queryTokens, labelTokens).chars;
}

// HOW MUCH OF THE MATCH WAS IN THE RIGHT ORDER.
//
//   Andy: "if all tokens match in sequence, that must be a higher score
//   than tokens matching out of sequence."
//
// `order` holds the label position each matched query word landed on, in
// query order. If the words came out in the same order they went in, that
// list ascends. So the question is how much of it ascends — the longest
// increasing run that need not be contiguous, over how many words matched.
//
// SAME PRINCIPLE AS THE TOKEN COMPARISON, which is what makes it simple.
//
//   Andy: "is there a simple scoring of sequence matching.... same
//   principle as token comparisons"
//
// tokenScore takes the longest RUN of characters two words share. This
// takes the longest RUN of words that came out in the order they went in —
// the same idea one level up, and five lines rather than the longest-
// increasing-subsequence search that stood here first. That was more
// machinery for an answer that differs only on orderings like
// [0,3,1,2], where it would say three and this says two; neither is more
// obviously right, and only one of them can be read at a glance.
//
// NOT "is it sorted", which would be a boolean and would throw away the
// difference between one word out of place and a complete reversal.
// "one two three four" against "one three two four" keeps three of its
// four words in order and should read that way.
//
// GAPS IN THE LABEL DO NOT BREAK A RUN. "one X two Y three" is in
// sequence — what is measured is the order of the words that matched, not
// how tightly packed they are. This is where it departs from tokenScore
// on purpose: characters inside a word are one thing, words inside a name
// with other words between them are another.
function sequenceRun(order) {
  if (order.length < 2) return order.length;
  var best = 1;
  var run = 1;
  for (var i = 1; i < order.length; i++) {
    run = order[i] > order[i - 1] ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

// WHAT ADMITS A ROW, as opposed to what scores it.
//
//   Andy: "there is no reason to not-admit, while the bucket isn't
//   overflowing."
//
// Correct, and it moves the whole argument. This gate was whole-tokens-
// only, on the grounds that partial overlap would qualify most of a
// million rows — but the BUCKET bounds the output, and a person who gets
// three results would rather see thirty-two weak ones than be told no.
// Quality decides what survives; admission only decides what is looked at.
//
// SO THE GATE IS ABOUT COST, AND NOTHING ELSE. `indexOf` of each query
// token against the label: one scan per token, no allocation, no dynamic
// programming. It admits `annabel` for the query `ann smith`, which whole
// tokens refused and which is plainly a result worth seeing.
//
// What it still refuses is "these two strings share a letter", which is
// nearly everything — and the reason that matters is the NEXT step: every
// admitted row pays for a longest-run search per token pair, and at a
// million rows the difference between a filter and no filter is the
// difference between a search and an outage.
function anyTokenFound(queryTokens, label) {
  for (var i = 0; i < queryTokens.length; i++) {
    if (queryTokens[i] && label.indexOf(queryTokens[i]) !== -1) return true;
  }
  return false;
}

// How good a match is, lowest is best. A plain query still means
// "anywhere", which is what somebody typing three letters expects — the
// wildcards are for when they want to say something more precise.
//
//   0  exact
//   1  starts with
//   2  found somewhere
//   3  only some of the words, in any order
//  -1  no
//
// NO FLOOR ON QUERY LENGTH. Andy: "Searches for 'a' must be successful,
// even if there's a million potential peers." One letter is a legitimate
// question; the answer to a broad one is the CAP, not a refusal.
function rank(label, query, multi) {
  if (query.indexOf('*') !== -1 || query.indexOf('?') !== -1) {
    if (!globMatches(label, query)) return -1;
    // An anchored pattern is a stronger statement than a floating one.
    return query[0] === '*' ? 2 : 1;
  }
  if (label === query) return 0;
  if (label.indexOf(query) === 0) return 1;
  if (label.indexOf(query) !== -1) return 2;

  // ── TIER 3: SOME OF THE WORDS ──────────────────────────────────────
  //
  // "one two three four" against "six twelve four one" is not a substring
  // of anything and used to be NO MATCH — which is why the token signals
  // needed this before they could ever fire. Some of the words are right;
  // that is worse than finding the whole query somewhere, and much better
  // than nothing.
  //
  // ONLY FOR A MULTI-TOKEN QUERY, and that is not an optimisation for its
  // own sake: a single-token query that matches a whole token is ALWAYS
  // already a substring match, so the check could only ever cost a split
  // per row and never change an answer. A million rows is the size this
  // was built for.
  // `multi` is computed once per search by `open`. This was a regex test
  // per row.
  if (multi === undefined) multi = SEPARATORS.test(query);
  if (!multi) return -1;
  return anyTokenFound(tokens(query), label) ? 3 : -1;
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

// ── QUALITY IS A PROBABILITY, AND THE TEXT_SIGNALS ARE WEIGHTED ───────────
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
var TEXT_SIGNALS = [
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
      var q = s.literal;
      var l = s.text.length;
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
      if (!s.queryTokens.length || !s.typed) return 0;
      return overlapChars(s.queryTokens, s.textTokens) / s.typed;
    },
  },

  // WERE THEY IN THE RIGHT ORDER.
  //
  //   Andy: "if all tokens match in sequence, that must be a higher score
  //   than tokens matching out of sequence."
  //
  // The token signal above is blind to order: "one two three four" and
  // "four three two one" match every word and score identically on it.
  // A name is not a set of words, and somebody typing them in an order
  // meant that order.
  //
  // Trivially 1.0 when one word matched — there is no sequence to be
  // wrong about — which keeps it neutral for the ordinary one-word search
  // rather than making every such row look perfect at something.
  {
    name: 'sequence',
    weight: 0.25,
    quality: function (s) {
      if (s.queryTokens.length < 2) return 1;
      var m = matchTokens(s.queryTokens, s.textTokens);
      if (!m.order.length) return 0;
      return sequenceRun(m.order) / m.order.length;
    },
  },

];

// The weighted mean — 0.0 to 1.0, so the total reads on the same scale as
// the parts and a caller can show it to a person without explaining it.
//
// Normalised by the weights actually present, so adding a signal does not
// silently rescale every score that came before it.
function explain(item, query, opts) {
  opts = opts || {};
  var textOf = opts.text || function (x) { return String(x); };
  var signals = TEXT_SIGNALS.concat(opts.signals || []);
  var q = String(query == null ? '' : query).toLowerCase();
  var text = String(textOf(item) || '').toLowerCase();
  var qTokens = tokens(q.replace(/[*?]/g, ' '));
  var s = {
    item: item, text: text, textTokens: tokens(text),
    rank: rank(text, q),
    queryTokens: qTokens, literal: q.replace(/[*?]/g, '').length,
    typed: qTokens.reduce(function (n, t) { return n + t.length; }, 0),
  };
  if (s.rank < 0) return { matched: false, quality: 0, signals: [] };

  var total = 0;
  signals.forEach(function (sig) { if (sig.weight > 0) total += sig.weight; });
  var sum = 0;
  var parts = signals.map(function (sig) {
    var v = sig.quality(s);
    if (!(v >= 0)) v = 0;
    if (v > 1) v = 1;
    sum += sig.weight * v;
    return { name: sig.name, weight: sig.weight, quality: v, contribution: sig.weight * v };
  });
  return { matched: true, quality: total > 0 ? sum / total : 0, signals: parts };
}

// -- A SEARCH IS A BUCKET YOU DROP CANDIDATES INTO --------------------
//
//   Andy: "the bucket is always the only thing that actually does the
//   search comparisons, the algorithm doesn't need to be known outside of
//   this bucket module."
//   Andy: "a search simply drops all candidates into the bucket.... it
//   handles everything else."
//
// So this is the whole interaction. `open` gives you something with two
// methods; you offer rows and you read the result. Nothing about ranking,
// matching, tokens, weights or eviction is visible from outside, and the
// only caller in the tree names none of it.
//
// THE QUERY BELONGS TO THE BUCKET, not to each offer. It was an argument
// per row, which meant lowercasing it, stripping its wildcards and
// splitting it into words ONCE PER ROW -- a million times over, for the
// search that justified all of this. Now it happens once, here, and every
// row is graded against the result.
function open(query, opts) {
  opts = opts || {};

  // THE ONE THING A CALLER MUST SUPPLY. Everything else about the object
  // is the caller business.
  var textOf = opts.text;
  if (typeof textOf !== 'function') {
    throw new Error('gradedSearch.open needs opts.text(item) -> the string to match against');
  }

  // The text signals, plus whatever the caller knows about its own kind of
  // object. A caller signal reads `s.item` and nothing else here does.
  var signals = TEXT_SIGNALS.concat(opts.signals || []);
  var weightTotal = 0;
  signals.forEach(function (sig) { if (sig.weight > 0) weightTotal += sig.weight; });

  var q = String(query == null ? '' : query).toLowerCase();
  var queryTokens = tokens(q.replace(/[*?]/g, ' '));
  var literal = q.replace(/[*?]/g, '').length;
  var typed = queryTokens.reduce(function (n, t) { return n + t.length; }, 0);
  var multi = SEPARATORS.test(q);

  function graded(scored) {
    var sum = 0;
    for (var i = 0; i < signals.length; i++) {
      var w = signals[i].weight;
      if (!(w > 0)) continue;
      var v = signals[i].quality(scored);
      if (!(v >= 0)) v = 0;
      if (v > 1) v = 1;
      sum += w * v;
    }
    return weightTotal > 0 ? sum / weightTotal : 0;
  }

  // MEASURED ONCE PER ROW, not once per comparison. A bucket compares a
  // row O(log k) times on the way to its seat, and the token signals run a
  // longest-run search.
  function compareScored(a, b) {
    var qa = a.q === undefined ? (a.q = graded(a)) : a.q;
    var qb = b.q === undefined ? (b.q = graded(b)) : b.q;
    if (qa !== qb) return qb - qa;
    var byText = a.text.localeCompare(b.text);
    if (byText !== 0) return byText;
    return String(a.id).localeCompare(String(b.id));
  }

  var held = bucket.createBucket(
    typeof opts.slots === 'number' && opts.slots > 0 ? opts.slots : SLOTS,
    compareScored);

  return {
    // A candidate. `tag` is whatever the caller wants to remember about
    // where this one came from; it is carried through untouched and no
    // signal here reads it.
    offer: function (item, tag) {
      var text = String(textOf(item) || '').toLowerCase();
      var r = rank(text, q, multi);
      if (r < 0) return false;
      return held.offer({
        item: item,
        tag: tag,
        // The tiebreak of last resort has to be unique or the order is not
        // total. The caller says what identity means for its objects; the
        // text is the fallback when it does not.
        id: opts.id ? opts.id(item) : text,
        text: text,
        textTokens: tokens(text),
        rank: r,
        queryTokens: queryTokens,
        literal: literal,
        typed: typed,
      });
    },

    // Best first, and whether there were more. Each entry is
    // `{ item, tag, quality }` -- the caller object, untouched, plus what
    // this thought of it.
    result: function () {
      return {
        matches: held.items().map(function (x) {
          return { item: x.item, tag: x.tag, quality: x.q === undefined ? graded(x) : x.q };
        }),
        more: held.more(),
      };
    },
  };
}

// -- THE CONVENIENCES, OVER EXACTLY THAT ------------------------------

function search(items, query, opts) {
  var b = open(query, opts);
  (items || []).forEach(function (item) { b.offer(item); });
  return b.result();
}

// Each source is `{ tag, items }`. IT DOES NOT TRUST THE ORDER IT IS
// GIVEN: a partner ranked its own reply with its own copy of this file, at
// whatever version it is running, and nothing here reads that order. Every
// item is graded again, which is also the only way a cap across the merged
// set means anything.
//
// DE-DUPLICATED on the way out by whatever `opts.id` says identity is, the
// better copy winning. Room for duplicates on the way in, or one item held
// by three sources could push a distinct one out of a seat it had earned.
//
// ── BUT THE LOSERS' TAGS ARE KEPT ────────────────────────────────────
//
//   Andy: "if you pay the price for search, may as well get valuable,
//   cachable routing info with it."
//
// The duplicate ROWS are dropped and the sources that offered them are
// not. A caller that fanned a question out has already paid for every
// answer; throwing away "and these other sources hold it too" discards
// information that cost exactly as much as the information kept.
//
// `tags` is therefore every source that offered the winning item, in the
// order they ranked, with the winner's own tag first. For the peer search
// that is every relay a peer was found on rather than only the best one —
// which is a routing table arriving free with a question somebody asked
// for another reason.
function merge(sources, query, opts) {
  opts = opts || {};
  var n = typeof opts.slots === 'number' && opts.slots > 0 ? opts.slots : SLOTS;
  var wide = {};
  Object.keys(opts).forEach(function (k) { wide[k] = opts[k]; });
  wide.slots = n * ((sources && sources.length) || 1);

  var b = open(query, wide);
  (sources || []).forEach(function (source) {
    if (!source) return;
    (source.items || []).forEach(function (item) { b.offer(item, source.tag); });
  });

  var all = b.result();
  var seen = Object.create(null);
  var unique = [];
  var idOf = opts.id || function (item) { return String(item); };
  all.matches.forEach(function (m) {
    var id = idOf(m.item);
    if (seen[id]) {
      // Not a discard: the row loses, its SOURCE is recorded on the
      // winner. Guarded against repeats so a source offering the same
      // item twice is named once.
      var kept = seen[id];
      if (kept.tags.indexOf(m.tag) === -1) kept.tags.push(m.tag);
      return;
    }
    m.tags = [m.tag];
    seen[id] = m;
    unique.push(m);
  });

  return { matches: unique.slice(0, n), more: all.more || unique.length > n };
}

// -- WHAT IS PUBLIC, AND IT IS SMALL ----------------------------------
//
// Andy: "the algorithm doesn't need to be known outside of this bucket
// module." A caller opens a search, drops candidates in, reads the result.
//
// TEXT_SIGNALS and their weights are public because they are the TUNING
// SURFACE, and `explain` for the same reason -- so a weight can be argued
// about with numbers rather than impressions.
//
// Everything else sits under `internal`, for the suite alone.
module.exports = {
  open: open,
  search: search,
  merge: merge,
  explain: explain,
  TEXT_SIGNALS: TEXT_SIGNALS,
  SLOTS: SLOTS,

};
