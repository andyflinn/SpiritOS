'use strict';

// spirit/test/playPopulate.js
// A RELAY FULL OF PEOPLE WHO ARE NAMED LIKE PEOPLE.
//
//   Andy: "create a little loop that generates new public keys and then
//   creates an invite for it, the key consumes it, and labels the roll
//   entry with consecutive lines of a shakespeare play — create 200
//   searchable entries on the fly."
//
// ── WHY NOT m0, m1, m2 ───────────────────────────────────────────────
//
// Because a ranker fed `m0…m199` is being asked a question nobody will
// ever ask it. Real labels share prefixes, repeat words, vary wildly in
// length, collide outright, and contain the short common words that a
// search for "a" has to survive — which is the requirement the whole
// bucket exists for:
//
//   Andy: "searches for 'a' must be successful, even if there's a million
//   potential peers."
//
// Consecutive lines of a play give all of that for free, and they give it
// the same way every time: no randomness, so a run that ranks differently
// ranks differently for a reason.
//
// TWO MODES, AND THEY TEST DIFFERENT THINGS.
//
//   `window` (default)  a sliding window over the token stream. 200
//                       people get 200 distinct labels that OVERLAP —
//                       "To be,", "be, or not", "or not to be," — which
//                       is the shared-prefix collision a real population
//                       has and a list of unique names does not.
//
//   `line`              whole lines, repeating past the forty-ninth. A
//                       population then contains people who share a label
//                       EXACTLY, which is the "two johns" case R1 exists
//                       for. Also the readable one when a failure has to
//                       be explained to somebody.
//
// Neither is random. A run that ranks differently ranks differently for a
// reason, which is the only way a ranking test is worth anything.
//
// ── IT ENROLS THE REAL WAY ───────────────────────────────────────────
//
// Mint an invite, claim it, consume it. A fixture that writes rows
// straight into the routing table proves rules against a relay nobody
// could join — and the two things most easily got wrong here are both in
// the enrolment path: the invite label must be SPOKEN-safe
// (`[A-Za-z0-9._-]{1,32}`, so no spaces), while the claimed label may be
// the line itself (48 graphemes, spaces and punctuation allowed).
//
// And every claim carries its own `clientKey`. CLAIM_PER_MIN is ten
// against one shared bucket, so a loop that passes null for all of them
// quietly enrols ten people and reports success — which cost an hour in
// `boundedByTime` before it was noticed.

const auth = require('../run/js/relayAuth');

// ── THE TEXT ─────────────────────────────────────────────────────────
//
// Hamlet III.i and a sonnet, trimmed to lines of 48 graphemes or fewer
// because that is what a label may hold. Public domain, embedded rather
// than fetched: a fixture that reaches the network is a fixture that
// fails on a train.
const LINES = [
  'To be, or not to be, that is the question',
  'Whether tis nobler in the mind to suffer',
  'The slings and arrows of outrageous fortune',
  'Or to take arms against a sea of troubles',
  'And by opposing end them. To die, to sleep',
  'No more, and by a sleep to say we end',
  'The heart-ache and the thousand natural shocks',
  'That flesh is heir to: tis a consummation',
  'Devoutly to be wishd. To die, to sleep',
  'To sleep, perchance to dream, ay, theres the rub',
  'For in that sleep of death what dreams may come',
  'When we have shuffled off this mortal coil',
  'Must give us pause. Theres the respect',
  'That makes calamity of so long life',
  'For who would bear the whips and scorns of time',
  'The oppressors wrong, the proud mans contumely',
  'The pangs of despised love, the laws delay',
  'The insolence of office, and the spurns',
  'That patient merit of the unworthy takes',
  'When he himself might his quietus make',
  'With a bare bodkin? Who would fardels bear',
  'To grunt and sweat under a weary life',
  'But that the dread of something after death',
  'The undiscoverd country, from whose bourn',
  'No traveller returns, puzzles the will',
  'And makes us rather bear those ills we have',
  'Than fly to others that we know not of',
  'Thus conscience does make cowards of us all',
  'And thus the native hue of resolution',
  'Is sicklied oer with the pale cast of thought',
  'And enterprises of great pith and moment',
  'With this regard their currents turn awry',
  'And lose the name of action. Soft you now',
  'The fair Ophelia! Nymph, in thy orisons',
  'Be all my sins rememberd',
  'Shall I compare thee to a summers day?',
  'Thou art more lovely and more temperate',
  'Rough winds do shake the darling buds of May',
  'And summers lease hath all too short a date',
  'Sometime too hot the eye of heaven shines',
  'And often is his gold complexion dimmd',
  'And every fair from fair sometime declines',
  'By chance or natures changing course untrimmd',
  'But thy eternal summer shall not fade',
  'Nor lose possession of that fair thou owest',
  'Nor shall Death brag thou wanderst in his shade',
  'When in eternal lines to time thou growest',
  'So long as men can breathe or eyes can see',
  'So long lives this and this gives life to thee',
];

// The line for entry `i`, wrapping so a population larger than the
// excerpt contains genuine duplicate labels rather than invented ones.
function lineFor(i) {
  return LINES[i % LINES.length];
}

// -- OR A WINDOW OVER THE WORDS, WHICH GOES FURTHER -------------------
//
//   Andy: "or just consume tokens of an ebook.... to fill labels...."
//
// Whole lines run out at forty-nine. Sliding a window over the TOKEN
// STREAM does not: ~400 words give ~400 distinct labels, and consecutive
// ones OVERLAP -- "slings and arrows of outrageous", "and arrows of
// outrageous fortune" -- which is better test data than distinct lines,
// because a real population shares prefixes and this manufactures that
// sharing honestly rather than by naming everybody `m0`.
//
// AND IT TAKES A REAL BOOK IF YOU HAVE ONE. `opts.text` accepts any
// corpus, so a caller with a Gutenberg file on disk can hand it over and
// get thousands of labels from it. The default is embedded because a
// fixture that reaches the network is a fixture that fails on a train,
// and a megabyte of somebody else's prose is not worth committing to make
// a ranker sweat.
function wordsOf(text) {
  return String(text || '')
    .split(/\s+/)
    .map(function (w) { return w.trim(); })
    .filter(Boolean);
}

var DEFAULT_WORDS = wordsOf(LINES.join(' '));

// Lengths cycle 2..6 words so labels vary the way names do -- some short,
// some long -- rather than all being the same shape. Truncated to 48
// graphemes because that is what a label may hold (labelRule.js), and cut
// at a word boundary so the result still reads like something a person
// typed.
function windowFor(i, words) {
  var stream = (words && words.length) ? words : DEFAULT_WORDS;
  var span = 2 + (i % 5);
  var out = [];
  for (var k = 0; k < span; k += 1) {
    out.push(stream[(i + k) % stream.length]);
  }
  var label = out.join(' ');
  while (Array.from(label).length > 48) {
    out.pop();
    label = out.join(' ');
  }
  return label;
}

// ── THE LOOP ─────────────────────────────────────────────────────────
//
// `box` is a relay, `ownerName` is the label its owner claimed with, and
// `count` is how many people to enrol. Returns what a caller needs to
// drive them: the identity, the label it wears, and the handle its invite
// was minted under.
//
// Refusals are not swallowed. A relay that stops enrolling — a rate gate,
// a label rule, a duplicate handle — must surface here rather than
// leaving a caller measuring a population it does not have.
// `opts.text` -- any corpus, so a caller with an ebook on disk can use it.
// `opts.mode` -- 'window' (default) slides over the token stream, 'line'
// uses whole lines, which is the readable one when a failure has to be
// explained to somebody.
function populate(box, ownerName, count, onProblem, opts) {
  opts = opts || {};
  const words = opts.text ? wordsOf(opts.text) : DEFAULT_WORDS;
  const byLine = opts.mode === 'line';
  const people = [];
  for (let i = 0; i < count; i += 1) {
    const id = auth.generateIdentity('p' + i);
    // SPOKEN-SAFE, and unique: the invite's label is the tight rule, and
    // two live invites cannot wear one name.
    const handle = 'line' + String(i).padStart(4, '0');
    const minted = box.mint(ownerName, handle, 7, '');
    if (!minted || !minted.ok) {
      if (onProblem) onProblem('mint ' + handle, minted);
      break;
    }
    const label = byLine ? lineFor(i) : windowFor(i, words);
    const claimed = box.claim(label,
      auth.sign(id.privateKey, auth.claimMessage(label)),
      id.publicKey,
      // Its own bucket, or CLAIM_PER_MIN stops the loop at ten.
      'client-' + i,
      minted.invite.token,
      handle);
    if (!claimed || !claimed.ok) {
      if (onProblem) onProblem('claim ' + handle, claimed);
      break;
    }
    people.push({ id: id, label: label, handle: handle, index: i });
  }
  return people;
}

module.exports = {
  populate: populate,
  lineFor: lineFor,
  windowFor: windowFor,
  wordsOf: wordsOf,
  LINES: LINES,
};
