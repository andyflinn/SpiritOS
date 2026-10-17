'use strict';

// ONE SCOPE OF ITS OWN (goal/G27.14): loaded into a page as a plain script, its names stay its own.
(function () {

// spirit/run/js/probabilityStringMatch.js
// HOW LIKELY TWO STRINGS MEAN THE SAME THING, AS A PROBABILITY — goal/G18.2, the first of the probabilit* modules.
//
//   Andy, 2026-10-12 (goal/G18): "i have a strong dislike for the search system right now. what i want to do: add a set
//   of core modules in run/js that start with probabilit(ModuleName).js and build them one by one. 3 of them. After
//   that we discuss how to integrated them."
//   The item: "result probability = probabilityStringMatch(A,B) where A and B must be strings." "if A or B are not of
//   type string return 0.0; if A is EXACTLY equal to B return 1.0"; "shorterString = the shorter String of A and B,
//   longerString = longer String of A and B; if they are of equal length, shorterString = A, longerString = B, then use
//   the logic from gradedSearch to return a result between 0 and 1". And: "in this version, we just compute the
//   matching of two string, no matter which one is the search string."
//
// THE LOGIC IS gradedSearch.js's, COPIED, NOT REQUIRED: the helpers below are its own (fold, tokens, longestRun,
// tokenScore, matchTokens, sequenceRun, anyTokenFound, rank and the four signals with their weights), so the shorter
// string is graded as its query and the longer as its label. gradedSearch.js is left as it is until the integration is
// argued. What differs is what "no search string" asks for: no wildcards, so * and ? are characters like any other.
//
// NO I/O, NO CLOCK, NO STATE: two strings in, one number out.

// ── ACCENTS FOLDED, BOTH WAYS (gradedSearch: "ü matches u and é matches e, both ways") ──
function fold(text) {
  var s = String(text == null ? '' : text).toLowerCase();
  return typeof s.normalize === 'function' ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
}

var SEPARATORS = /[\s\-_.,/]/;

function tokens(text) {
  return String(text || '').split(/[\s\-_.,/]+/).filter(function (t) { return t.length > 0; });
}

// ONE TOKEN AGAINST ONE TOKEN: the whole word is worth its length, a part of a longer word the share it accounts for,
// a longer query word nothing (gradedSearch: "if the result token is shorter, its obviously no match").
function tokenScore(queryToken, resultToken) {
  if (resultToken.length < queryToken.length) return 0;
  if (resultToken === queryToken) return queryToken.length;
  var run = longestRun(queryToken, resultToken);
  if (!run) return 0;
  return run * (run / resultToken.length);
}

// The longest run of characters two words share, two rolling rows.
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

// HOW MANY CHARACTERS MATCHED, whole words first, then the best partial for what is left; and where they landed.
function matchTokens(queryTokens, labelTokens) {
  var taken = new Array(labelTokens.length).fill(false);
  var chars = 0;
  var order = [];
  var left = [];
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

// HOW MUCH OF THE MATCH WAS IN THE RIGHT ORDER: the longest run of words that came out as they went in.
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

function anyTokenFound(queryTokens, label) {
  for (var i = 0; i < queryTokens.length; i++) {
    if (queryTokens[i] && label.indexOf(queryTokens[i]) !== -1) return true;
  }
  return false;
}

// HOW GOOD A MATCH IS: 0 exact, 1 starts with, 2 found somewhere, 3 some of the words, -1 none. gradedSearch's rank
// without its wildcard branch.
function rank(label, query) {
  if (label === query) return 0;
  if (label.indexOf(query) === 0) return 1;
  if (label.indexOf(query) !== -1) return 2;
  if (!SEPARATORS.test(query)) return -1;
  return anyTokenFound(tokens(query), label) ? 3 : -1;
}

// THE FOUR SIGNALS AND THEIR WEIGHTS, gradedSearch's TEXT_SIGNALS as they stand.
var SIGNALS = [
  { name: 'match', weight: 1.0, quality: function (s) {
    if (s.rank === 0) return 1.0;
    if (s.rank === 1) return 0.7;
    if (s.rank === 2) return 0.35;
    return 0.15;
  } },
  { name: 'coverage', weight: 0.2, quality: function (s) {
    var q = s.literal;
    var l = s.text.length;
    if (!q || !l) return 0;
    return q < l ? q / l : l / q;
  } },
  { name: 'tokens', weight: 0.3, quality: function (s) {
    if (!s.queryTokens.length || !s.typed) return 0;
    return matchTokens(s.queryTokens, s.textTokens).chars / s.typed;
  } },
  { name: 'sequence', weight: 0.25, quality: function (s) {
    if (s.queryTokens.length < 2) return 1;
    var mt = matchTokens(s.queryTokens, s.textTokens);
    if (!mt.order.length) return 0;
    return sequenceRun(mt.order) / mt.order.length;
  } },
];

// THE LONGER GRADED AGAINST THE SHORTER: the weighted mean of the signals, 0 to 1.
function graded(longer, shorter) {
  var q = fold(shorter);
  var text = fold(longer);
  var qTokens = tokens(q);
  var s = {
    text: text, textTokens: tokens(text), rank: rank(text, q),
    queryTokens: qTokens, literal: q.length,
    typed: qTokens.reduce(function (n, t) { return n + t.length; }, 0),
  };
  if (s.rank < 0) return 0;
  var total = 0;
  var sum = 0;
  SIGNALS.forEach(function (sig) {
    var v = sig.quality(s);
    if (!(v >= 0)) v = 0;
    if (v > 1) v = 1;
    total += sig.weight;
    sum += sig.weight * v;
  });
  return total > 0 ? sum / total : 0;
}

function probabilityStringMatch(A, B) {
  if (typeof A !== 'string' || typeof B !== 'string') return 0.0;
  if (A === B) return 1.0;
  // NOTHING MATCHES SOMETHING NOT AT ALL. Andy, 2026-10-12: "and empty string against a non-empty string should return
  // 0". gradedSearch's rank calls '' a prefix of every string, which gave it 0.54.
  if (A === '' || B === '') return 0.0;
  // The shorter is graded as the query; of two the same length, A ("shorterString = A, longerString = B").
  var shorter = A.length <= B.length ? A : B;
  var longer = shorter === A ? B : A;
  return graded(longer, shorter);
}

// IN NODE AND IN A PAGE ALIKE (goal/G27.14). Andy, 2026-10-17: "why down't the UI run the exact same search code in
// the shell? ... any search can then easiliy accumulate a cache that can be expanded with every search? it's a
// pattern....". A page loads this file as it is and finds it on window.spiritProbability.
if (typeof module !== 'undefined' && module && module.exports) module.exports = { probabilityStringMatch: probabilityStringMatch };
if (typeof window !== 'undefined' && window) {
  window.spiritProbability = window.spiritProbability || {};
  window.spiritProbability.probabilityStringMatch = probabilityStringMatch;
}
}());
