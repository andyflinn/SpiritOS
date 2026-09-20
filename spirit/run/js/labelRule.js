'use strict';

// spirit/run/js/labelRule.js
// What a label may be — one definition, both sides of the wire.
//
//   Andy: "an input field should validate before taxing the wire. the
//   reason to have it there is to make it uniformely avalable to all
//   components. hops on wire can be saved etc..."
//
// ── WHO ENFORCES, AND WHO IS ONLY BEING POLITE ───────────────────────
//
// THE RELAY ENFORCES. It is the one writing the enrolment ledger, and it
// checks every claim and every rename whatever any browser believed.
// Nothing in here changes that, and an app must never be the only thing
// standing between a person and the ledger.
//
// AN INPUT FIELD IS A COURTESY. It saves a hop and says what is wrong
// while the cursor is still in the box, which is the difference between
// "bad name" arriving from another continent and a form that simply will
// not let you type a tab into somebody's name.
//
// The two must agree, and that is the whole reason this is a file rather
// than a rule written twice. ownerBadge.js says it for its own rule and
// it is just as true here: a rule copied into a second file is a rule
// that will be changed in one of them.
//
// ── TWO FIELDS, TWO RULES ────────────────────────────────────────────
//
//   PUBLIC LABEL — owned by the key, displayed, never spoken. Unicode:
//     spaces, punctuation, any visible character. It should be able to
//     hold a person's actual name.
//   SPOKEN WORD — an invite's label and its token, read down a phone
//     call and retyped by a stranger, compared exactly. Tight, because
//     "was that a hyphen or a dash, one space or two" is a real cost
//     there and none at all on a caption.
//   DESCRIPTION — a sentence a node says about itself to anybody who
//     asks (nodeCard.js). Prose, so it is the most permissive of the
//     three and the only one that may be EMPTY: a node that has not
//     written one yet is an ordinary state, not a broken form.
//
// Why permissive is safe for the first and would not be in most systems:
// a label is not an identity. The key is (R4), duplicate labels are legal
// by design, nothing routes on a label and nothing is filed under one.
//
// ── ISOMORPHIC, THE WAY ownerBadge.js IS ─────────────────────────────
//
// No filesystem, no crypto, no Buffer — TextEncoder counts UTF-8 bytes
// in node and in every browser, so there is ONE implementation rather
// than one per environment that could drift.

var LABEL_MAX_BYTES = 256;
var LABEL_MAX_GRAPHEMES = 48;

// The spoken pair: 1-32 of the characters that survive being read aloud.
// Also the token rule — a spoken token has no entropy floor (`dog` is a
// legal token), which is why the invite LABEL is the second factor.
var SPOKEN_RE = /^[A-Za-z0-9._-]{1,32}$/;

// ── THE BLACKLIST IS OF THE INVISIBLE, NOT OF PUNCTUATION ────────────
//
// Every visible character is allowed. What is refused is what cannot be
// seen and therefore cannot be judged: C0/C1 controls, the soft hyphen,
// zero-width space/joiner/non-joiner and the marks, line and paragraph
// separators, the bidi overrides and isolates, and the byte-order mark.
// Those break a table row, reverse what a reader sees, or make two
// different labels pixel-identical.
//
// Ordinary whitespace is NOT here, because `normalize` collapses it: a
// tab pasted out of a document is a formatting accident, not an attack.
// U+FEFF is in this list and never reaches it — JavaScript counts it as
// whitespace, so it collapses first. Kept anyway, so the list reads as
// the complete statement of intent rather than as a set of leftovers.
var INVISIBLE_RE = new RegExp(
  '[\\u0000-\\u001F\\u007F-\\u009F\\u00AD\\u200B-\\u200F' +
  '\\u2028\\u2029\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u206F\\uFEFF]');

// Graphemes, not codepoints: an emoji with a skin-tone modifier is one
// thing a reader sees and two codepoints. Intl.Segmenter is in every
// current browser and Node 18+; the fallback counts codepoints, which is
// wrong only in the direction of being more permissive.
var SEGMENTER = null;
try { SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'grapheme' }); }
catch (e) { SEGMENTER = null; }

var ENCODER = null;
try { ENCODER = new TextEncoder(); } catch (e) { ENCODER = null; }

function graphemeCount(s) {
  if (SEGMENTER) return Array.from(SEGMENTER.segment(s)).length;
  return Array.from(s).length;
}

function byteLength(s) {
  if (ENCODER) return ENCODER.encode(s).length;
  // No TextEncoder anywhere this runs, but a length that silently
  // under-counts would let the ledger bound be exceeded, so: count the
  // codepoints the expensive way rather than trust `.length`.
  var n = 0;
  Array.from(s).forEach(function (ch) {
    var c = ch.codePointAt(0);
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  });
  return n;
}

// NFC FIRST, because Unicode lets the same name be two byte strings: `é`
// as one codepoint, or `e` followed by a combining accent. Without this
// the stored form depends on which keyboard typed it, the byte cap
// measures something unstable, and two identical-looking labels are
// unequal for no reason a person could see.
//
// THEN WHITESPACE COLLAPSES. `andy  flinn` and `andy flinn` must not be
// two rows that look the same in a list where duplicates are legal and
// the eye is the only thing telling them apart.
//
// AN APP MUST NORMALIZE BEFORE IT COUNTS. A length taken off the raw
// input disagrees with the relay's exactly for accented and double-spaced
// names — the worst kind of intermittent.
function normalize(name) {
  if (typeof name !== 'string') return '';
  var s = name.normalize ? name.normalize('NFC') : name;
  return s.replace(/\s+/g, ' ').trim();
}

// Returns WHY, not just whether. A label refused for being 300 bytes and
// one refused for carrying a bidi override are different problems for the
// person reading the message, and 'bad name' told them neither.
//
// Takes the RAW input and normalizes on the way in, so a caller cannot
// get the order wrong.
function problem(name) {
  var n = normalize(name);
  if (!n) return 'name required';
  if (INVISIBLE_RE.test(n)) return 'name has invisible or control characters';
  if (byteLength(n) > LABEL_MAX_BYTES) return 'name too long';
  if (graphemeCount(n) > LABEL_MAX_GRAPHEMES) return 'name too long';
  return '';
}

// The tight half: an invite's label and its token.
function spokenOk(word) {
  return !!word && SPOKEN_RE.test(word);
}

// ── THE FOURTH RULE: A LEVER'S NAME ──────────────────────────────────
//
//   Andy: "the naming convention for levers should include meaning001
//   (meaning and iteration) which still should fit the label naming
//   constraints."
//   Andy: "the meaning is restricted no a-z or A-Z the iteration is a
//   subgroup: the shortest 0-9 representation of an actual positive
//   integer."
//   Andy: "this rule can be layered on top of the invite label rule,
//   because it's a compatible subset."
//
// So it is written as a LAYER, not as a second regex that happens to be
// narrower: `spokenOk` first, then the lever shape. If the spoken rule
// ever tightens, this follows it; if it loosens, this does not. That is
// the whole reason this file exists — a rule copied is a rule that will
// be changed in one place only.
//
// WHY THE ITERATION AND NOT A VERSION FIELD. A lever is a thing the
// Governor learns to move, and what is learned about `connections1` does
// not transfer to `connections2` — different floors, different ceilings,
// different programme. The iteration is in the NAME so that two
// generations of a lever can be reported side by side and never confused
// for the same measurement.
//
//   Andy: "i wouldn't put constraints on the number of digits, i would
//   insist that the numerical value has to be unique. better no leading
//   zeros, for that matter."
//
// Hence `[1-9][0-9]*`: no leading zeros, and no `connections0`. One
// integer, one spelling — `connections01` and `connections1` must not be
// two names for one lever.
//
// A MEANING IS LETTERS ONLY, and the letters do the work a separator
// would:
//
//   Andy, asked how `ipv4` could ever be a meaning: "it's the uppercase
//   letters."
//
// So a meaning spells its parts in case rather than in punctuation —
// `requestTimeout1`, `ipvFour1` — and the digits at the end are always
// the iteration and never part of the meaning. `conn_1` is refused
// because a separator would be a second way to say the same thing.
//
// `ipv41` is therefore NOT refused by this rule. It is legal and it
// means `ipv` iteration 41, which is not what someone typing it intends.
// The rule cannot catch that and does not try: a name that parses
// differently than it reads is a naming mistake, and the answer is the
// convention above rather than a regex that guesses at intent.
var LEVER_RE = /^[A-Za-z]+[1-9][0-9]*$/;

function leverOk(label) {
  return spokenOk(label) && LEVER_RE.test(label);
}

// ── THE THIRD RULE: A SENTENCE ABOUT YOURSELF ────────────────────────
//
// 128 bytes, which is the cap relayAuth stores to and is repeated here
// for the reason this whole file exists: a rule in two files is a rule
// that will be changed in one of them. It is small on purpose — this
// travels as an answer to anybody who asks, and a node that can be made
// to emit a paragraph is a better amplifier than one that emits a line.
var DESCRIPTION_MAX_BYTES = 128;

// EMPTY IS FINE, and that is the one place this differs from `problem`.
// A name is required — a node with none cannot be enrolled to — and a
// description is something you may simply not have written. Clearing it
// is a legitimate edit, not a form to refuse.
//
// LENGTH IS NOT REFUSED EITHER. relayAuth trims prose to fit rather than
// rejecting it, and the two must agree or an app reports an error for
// something the node would have quietly accepted. So the only thing
// refused here is the invisible: a bidi override in a description sits
// in the same row as somebody's name, and reverses it just as well from
// either field.
function describeProblem(text) {
  var n = normalize(text);
  if (!n) return '';
  if (INVISIBLE_RE.test(n)) return 'description has invisible or control characters';
  return '';
}

// What is LEFT, for a field that counts down while somebody types. Bytes
// rather than characters because bytes are what the cap is in — an emoji
// costs four and a letter costs one, and a counter that says otherwise
// truncates somebody mid-word with no warning.
function describeRemaining(text) {
  return DESCRIPTION_MAX_BYTES - byteLength(normalize(text));
}

// Node gets everything; the browser gets the rules and nothing that would
// need a filesystem. Same split, and the same reason, as ownerBadge.js.
var RULE = {
  MAX_BYTES: LABEL_MAX_BYTES,
  MAX_GRAPHEMES: LABEL_MAX_GRAPHEMES,
  DESCRIPTION_MAX_BYTES: DESCRIPTION_MAX_BYTES,
  normalize: normalize,
  problem: problem,
  describeProblem: describeProblem,
  describeRemaining: describeRemaining,
  spokenOk: spokenOk,
  leverOk: leverOk,
  graphemeCount: graphemeCount,
  byteLength: byteLength,
};

if (typeof process !== 'undefined' && !!process.versions && !!process.versions.node) {
  module.exports = RULE;
} else if (typeof window !== 'undefined') {
  window.spiritLabelRule = RULE;
}
