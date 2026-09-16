'use strict';

// spirit/test/peerSearch.js
// THE GRADED SEARCH, DRIVEN WITH NOTHING RUNNING.
//
//   Andy: "i want the graded search logic and that stuff isolated from
//   relay or other core components, since quality-of-result measurements
//   etc. are up in the air and we need to have this block separately
//   tested and verified, and give it an independent evolution path."
//
// That last clause is what this file is for. A block whose answer is
// unsettled needs somewhere its answer can be CHANGED cheaply — and the
// only thing that makes a change cheap is being able to see what it did
// without standing up a relay, a node, a socket or a clock.
//
// So there is no fixture below. No temp directory, no spawned process, no
// fake fetch. Rows in, rows out, and every assertion is about the ordering
// itself rather than about a screen that displays it.
//
// WHAT IS DELIBERATELY NOT ASSERTED: the exact integers `rank` returns.
// Those are an implementation of "exact beats prefix beats anywhere", and
// pinning them would make the next quality signal a breaking change to a
// test that never cared. The checks are about RELATIVE ORDER, which is the
// contract, and about the properties a caller can rely on regardless of
// how the scoring is rewritten inside.

const test = require('./testSupport.js');
const peerSearch = require('../run/js/peerSearch');

// A row is four fields and nothing else — no relay, no key material, no
// clock. If this helper ever needs to grow, the boundary has leaked.
function row(label, opts) {
  opts = opts || {};
  return {
    publicKey: opts.key || ('K-' + label),
    publicLabel: label,
    present: !!opts.present,
    via: opts.via === undefined ? null : opts.via,
  };
}

function labelsOf(result) {
  return result.matches.map(function (m) { return m.publicLabel; });
}

// ── EVERYTHING BELOW GOES THROUGH THE PUBLIC SURFACE ─────────────────
//
//   Andy: "this whole enforcement rule must include calling inside-the
//   interface helpers. that is the whole point of interfaces. they must be
//   opaque. their internal mechanics shouldn't even be reachable."
//
// This suite used to reach through a `peerSearch.internal` bag — thirteen
// calls into globMatches, rank, tokens, tokenScore and overlapChars. The
// bag was mine and it was labelled "for the suite alone", which is an
// escape hatch with a note on it: if the mechanics are reachable they are
// not encapsulated, and a caller will eventually reach the same way for
// the same reason a test did.
//
// The rewrite is not a cost. Every one of those assertions was about a
// helper's return value; each is now about what the search DOES, which is
// the thing that must not change. rank's integers can be renumbered
// tomorrow and nothing below notices.

// Does this query find this label, and how good does the search think it
// is? `explain` is public because a weight has to be arguable with
// numbers.
function found(label, query, extra) {
  const r = { publicKey: 'K-' + label, publicLabel: label, present: false, via: null };
  Object.keys(extra || {}).forEach(function (k) { r[k] = extra[k]; });
  return peerSearch.explain(r, query);
}

function signal(label, query, name, extra) {
  const e = found(label, query, extra);
  if (!e.matched) return null;
  return e.signals.filter(function (x) { return x.name === name; })[0].quality;
}

test.startTest('Graded search — isolated, and driven with nothing running');

// ---------------------------------------------------------------------
test.subHeading('It stands alone');

{
  // THE ISOLATION IS THE FEATURE, so it is asserted rather than assumed,
  // and it is now a STACK of three rather than one file:
  //
  //   bucket.js        limited spots, weakest evicted. Knows nothing.
  //   gradedSearch.js  what makes one STRING a better answer. Knows
  //                    strings, not objects.
  //   peerSearch.js    the extractor and the two signals that read a peer.
  //
  //   Andy: "the interface only needs to supply a means of extracting the
  //   relevant comparison string from the object, so the bucket doesn't
  //   have to know the shape of the object."
  //
  // Each may depend on the one below it and on nothing else. A require of
  // relay.js, fs or a socket anywhere in here would make every quality
  // question cost a lab run to answer.
  const codeOf = function (name) {
    return require('fs').readFileSync(
      require('path').join(__dirname, '..', 'run', 'js', name), 'utf8')
      .split('\n')
      .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
      .join('\n');
  };
  const requiresOf = function (name) {
    return (codeOf(name).match(/require\(['"][^'"]+['"]\)/g) || [])
      .map(function (r) { return r.replace(/require\(['"]\.\/|['"]\)/g, ''); });
  };

  const stack = [
    ['bucket.js', []],
    ['gradedSearch.js', ['bucket']],
    ['peerSearch.js', ['gradedSearch']],
  ];
  const wrong = stack.filter(function (layer) {
    return requiresOf(layer[0]).join(',') !== layer[1].join(',');
  });

  if (wrong.length === 0) {
    test.check('three layers, each depending only on the one below: ' +
      stack.map(function (l) { return l[0].replace('.js', ''); }).join(' -> '));
  } else {
    test.fail('dependencies wrong: ' + wrong.map(function (l) {
      return l[0] + ' requires ' + (requiresOf(l[0]).join(', ') || 'nothing');
    }).join('; '));
  }

  // THE MIDDLE LAYER MUST NOT KNOW WHAT A PEER IS. The moment it reads
  // publicLabel, publicKey or present, the generalisation has gone and the
  // next thing worth searching has to fork it.
  const graded = codeOf('gradedSearch.js');
  const leaked = ['publicLabel', 'publicKey', 'present', 'via', 'relay', 'peer']
    .filter(function (w) { return new RegExp('\b' + w + '\b').test(graded); });
  if (leaked.length === 0) {
    test.check('and the string layer names nothing about peers — it could rank filenames');
  } else {
    test.fail('gradedSearch knows about: ' + leaked.join(', '));
  }

  // Presence as a FIELD, not a function. Taking `isPresent` would drag the
  // relay live socket state in through the back door and make every test
  // here stand up a registry to answer it.
  if (!/isPresent/.test(codeOf('peerSearch.js'))) {
    test.check('and presence is read off the row rather than asked of anybody');
  } else {
    test.fail('peerSearch calls isPresent — presence must arrive as a field');
  }
}

// ---------------------------------------------------------------------
test.subHeading('A better match comes first');

{
  const rows = [
    row('andrew'), row('and'), row('band'), row('anderson'),
  ];
  const got = labelsOf(peerSearch.search(rows, 'and'));

  // exact, then starts-with, then anywhere. Within starts-with, by label.
  if (got[0] === 'and') {
    test.check('the exact match is first');
  } else {
    test.fail('first was ' + got[0] + ' in ' + got.join(', '));
  }

  if (got.indexOf('anderson') < got.indexOf('band') && got.indexOf('andrew') < got.indexOf('band')) {
    test.check('a prefix beats a match found in the middle');
  } else {
    test.fail('order: ' + got.join(', '));
  }

  // THIS ASSERTION USED TO BE THE OPPOSITE, and it was pinning the
  // ALPHABETICAL fallback: `anderson` before `andrew` because `a` sorts
  // before `r`, which is not a quality judgement but the absence of one.
  // The coverage signal gave the tie a meaning — `and` is half of
  // `andrew` and three eighths of `anderson` — so the shorter name, which
  // the query accounts for more of, now wins on merit.
  if (got.indexOf('andrew') < got.indexOf('anderson')) {
    test.check('and between two prefixes the query covers more of, the closer name wins');
  } else {
    test.fail('coverage did not break the tie: ' + got.join(', '));
  }
}

// ---------------------------------------------------------------------
test.subHeading('Present beats absent, because absent cannot be posted to');

{
  // A relay stores nothing (0006), so an absent peer is a row you can file
  // and not a row you can act on. Same rank, so presence is what decides.
  const rows = [row('zara', { present: false }), row('zeta', { present: true })];
  const got = labelsOf(peerSearch.search(rows, 'z'));
  if (got[0] === 'zeta') {
    test.check('at equal rank the one who is here wins');
  } else {
    test.fail('order: ' + got.join(', '));
  }

  // But NOT over rank. Being reachable does not make somebody the person
  // who was asked for.
  const mixed = [row('zebra', { present: false }), row('buzz', { present: true })];
  const order = labelsOf(peerSearch.search(mixed, 'z'));
  if (order[0] === 'zebra') {
    test.check('and never over a better match — rank is asked first');
  } else {
    test.fail('presence outranked the match: ' + order.join(', '));
  }
}

// ---------------------------------------------------------------------
test.subHeading("A search for 'a' is a real question");

{
  //   Andy: "Searches for 'a' must be successful, even if there's a
  //   million potential peers..."
  //
  // There was a two-character floor once, and it was a crutch for not
  // having ranking. The answer to a broad question is the CAP.
  const many = [];
  for (let i = 0; i < 500; i++) many.push(row('name' + i + 'a'));
  many.push(row('a'));

  const got = peerSearch.search(many, 'a');
  if (got.matches.length === peerSearch.SLOTS && got.more === true) {
    test.check('one letter answers ' + peerSearch.SLOTS + ' rows and says there are more');
  } else {
    test.fail('got ' + got.matches.length + ' more=' + got.more);
  }

  if (got.matches[0].publicLabel === 'a') {
    test.check('and the exact match still leads, out of five hundred');
  } else {
    test.fail('first: ' + got.matches[0].publicLabel);
  }

  // An empty query matches everyone — which is "who is around", answered
  // by the same verb rather than by a second one.
  const all = peerSearch.search(many, '');
  if (all.matches.length === peerSearch.SLOTS && all.more === true) {
    test.check('and an empty query is not an error — it is everyone, capped');
  } else {
    test.fail('empty: ' + all.matches.length + ' more=' + all.more);
  }
}

// ---------------------------------------------------------------------
test.subHeading('Wildcards, without handing a stranger a regex');

{
  // WILDCARD PATTERNS ONLY, and finding that out was the first thing the
  // public surface said. The table used to carry ['abc','abcd',false] —
  // true of the matcher, and unreachable through a search: a query with no
  // wildcard never consults it, it goes to the prefix rule and `abcd`
  // matches `abc`. An assertion about a branch no caller can take is an
  // assertion about the implementation, which is the thing being given up.
  const cases = [
    ['a*c', 'abc', true], ['a*c', 'ac', true], ['a*c', 'abd', false],
    ['a?c', 'abc', true], ['a?c', 'ac', false],
    ['*', 'anything', true], ['**', 'anything', true],
    ['a*z', 'abc', false],
  ];
  // Through the search rather than the matcher: a pattern either finds a
  // label or it does not, and that is the only thing a caller can observe.
  const wrong = cases.filter(function (c) {
    return found(c[1], c[0]).matched !== c[2];
  });
  if (wrong.length === 0) {
    test.check('* and ? mean what they should, ' + cases.length + ' cases');
  } else {
    test.fail('wrong: ' + wrong.map(function (c) { return c[0] + ' vs ' + c[1]; }).join(', '));
  }

  // THE REASON IT IS NOT A REGEXP. `*a*a*a*a*a*a*a*b` against a long label
  // is catastrophic backtracking in every regex engine, and on a public
  // relay it is a stranger choosing how much CPU to spend. The two-pointer
  // matcher backtracks only to the last `*`.
  const evil = '*a*a*a*a*a*a*a*a*a*a*a*b';
  const long = new Array(200).join('a');
  const began = Date.now();
  found(long, evil);
  const took = Date.now() - began;
  if (took < 100) {
    test.check('and the classic catastrophic pattern returns in ' + took + 'ms');
  } else {
    test.fail('took ' + took + 'ms — something compiled a regex');
  }

  // An anchored pattern is a stronger statement than a floating one.
  const rows = [row('xandra'), row('alexander')];
  const got = labelsOf(peerSearch.search(rows, 'a*'));
  if (got.length === 1 && got[0] === 'alexander') {
    test.check('`a*` is anchored — it does not find a match in the middle');
  } else {
    test.fail('a* matched: ' + got.join(', '));
  }
}

// ---------------------------------------------------------------------
test.subHeading('The order is total, so page two is the same everywhere');

{
  // A comparator answering 0 for two different rows leaves them to the
  // sort implementation — which differs between engines and between runs.
  // A search whose second page depends on which machine asked is not a
  // search anybody can page through.
  const twins = [
    row('same', { key: 'K-bbb' }),
    row('same', { key: 'K-aaa' }),
  ];
  const a = peerSearch.search(twins, 'same').matches.map(function (m) { return m.publicKey; });
  const b = peerSearch.search(twins.slice().reverse(), 'same').matches.map(function (m) { return m.publicKey; });
  if (a.join() === b.join()) {
    test.check('identical labels still sort identically whichever order they arrive in');
  } else {
    test.fail(a.join() + ' vs ' + b.join());
  }
}

// ---------------------------------------------------------------------
test.subHeading('The merger re-ranks, and does not trust what it is given');

{
  // A partner ranked its own reply, with its own copy of this file, at
  // whatever version it is running. Concatenating two sorted lists gives a
  // list sorted by nothing — and taking the top 32 of that is taking 32
  // arbitrary rows.
  const mine = { via: null, rows: [row('zzz-mine')] };
  const theirs = { via: 1, rows: [row('aaa-theirs'), row('exact')] };

  const merged = peerSearch.merge([mine, theirs], 'exact');
  if (merged.matches.length === 1 && merged.matches[0].publicLabel === 'exact') {
    test.check('it scores every source itself rather than believing the order');
  } else {
    test.fail('merged: ' + labelsOf(merged).join(', '));
  }

  // DELIBERATELY MIS-ORDERED: a source that answers worst-first must not
  // put its worst row at the top of the merged answer.
  const hostile = { via: 2, rows: [row('badmatch'), row('bad'), row('badly')] };
  const fixed = labelsOf(peerSearch.merge([hostile], 'bad'));
  if (fixed[0] === 'bad') {
    test.check('and a reply that arrives worst-first comes out best-first');
  } else {
    test.fail('order kept: ' + fixed.join(', '));
  }
}

// ---------------------------------------------------------------------
test.subHeading('A row remembers who supplied it, and the nearer copy wins');

{
  const mine = { via: null, rows: [row('dup', { key: 'K-dup' })] };
  const theirs = { via: 7, rows: [row('dup', { key: 'K-dup' }), row('only-theirs')] };

  const merged = peerSearch.merge([mine, theirs], '');
  const dup = merged.matches.filter(function (m) { return m.publicLabel === 'dup'; });

  if (dup.length === 1) {
    test.check('one row per key, however many sources answered with it');
  } else {
    test.fail('dup appeared ' + dup.length + ' times');
  }

  if (dup[0] && dup[0].via === null) {
    test.check('and the nearer source wins — acquiring needs a census this node can reach');
  } else {
    test.fail('kept via=' + (dup[0] && dup[0].via));
  }

  const far = merged.matches.filter(function (m) { return m.publicLabel === 'only-theirs'; })[0];
  if (far && far.via === 7) {
    test.check('a row only a partner had carries that partner, so a route can be recorded');
  } else {
    test.fail('via lost: ' + JSON.stringify(far));
  }

  // The caller's rows must not be mutated — `via` is stamped on a copy.
  if (mine.rows[0].via === null && theirs.rows[0].via === null) {
    test.check('and the sources are left as they were handed over');
  } else {
    test.fail('merge wrote back into its inputs');
  }
}

// ---------------------------------------------------------------------
test.subHeading('The cap holds across the merged set');

{
  const a = { via: null, rows: [] };
  const b = { via: 1, rows: [] };
  for (let i = 0; i < 40; i++) a.rows.push(row('a-peer' + i, { key: 'A' + i }));
  for (let i = 0; i < 40; i++) b.rows.push(row('b-peer' + i, { key: 'B' + i }));

  const merged = peerSearch.merge([a, b], 'peer');
  if (merged.matches.length === peerSearch.SLOTS && merged.more === true) {
    test.check('eighty rows from two sources answer ' + peerSearch.SLOTS + ', with more');
  } else {
    test.fail(merged.matches.length + ' rows, more=' + merged.more);
  }

  // The cap is ACROSS the set, not per source — two sources of 32 must not
  // answer 64.
  const overCap = merged.matches.length > peerSearch.SLOTS;
  if (!overCap) {
    test.check('and the cap is across the merge, not applied twice');
  } else {
    test.fail('cap applied per source: ' + merged.matches.length);
  }
}

// ---------------------------------------------------------------------
test.subHeading('Quality is a probability, and the signals are weighted');

{
  //   Andy: "lets define quality like probability a number from 0.0 to
  //   1.0. then different approaches to quality could be weighted to come
  //   up with an overall quality measurement."
  //
  // THE CONTRACT, asserted rather than assumed, because every signal Andy
  // adds has to satisfy it and a signal answering 7 would quietly reorder
  // everything.
  const bad = peerSearch.SIGNALS.filter(function (sig) {
    return !sig.name || typeof sig.quality !== 'function' || !(sig.weight > 0);
  });
  if (bad.length === 0) {
    test.check(peerSearch.SIGNALS.length + ' signals, each named, weighted and answering a function');
  } else {
    test.fail('malformed: ' + bad.map(function (b) { return b.name || '(unnamed)'; }).join(', '));
  }

  // EVERY SIGNAL STAYS ON THE SCALE. A probability that is not one is the
  // failure mode weighting has and precedence did not.
  // The shape `open` builds per candidate. `item` is the caller's object,
  // untouched — a peer signal reads that and nothing else. `text` is what
  // the extractor pulled out of it, and the query arrives pre-tokenised,
  // so no signal ever splits a string of its own.
  const probe = {
    item: { present: true, via: null, publicKey: 'K' },
    text: 'x', textTokens: ['x'], rank: 0,
    queryTokens: ['x'], literal: 1, typed: 1,
  };
  const offScale = peerSearch.SIGNALS.filter(function (sig) {
    const q = sig.quality(probe);
    return typeof q !== 'number' || q < 0 || q > 1;
  });
  if (offScale.length === 0) {
    test.check('and every one answers between 0.0 and 1.0');
  } else {
    test.fail('off scale: ' + offScale.map(function (b) { return b.name; }).join(', '));
  }

  // THE TOTAL IS ON THE SAME SCALE AS THE PARTS, so a caller can show it
  // to a person without explaining it.
  const best = peerSearch.explain(
    { publicKey: 'K', publicLabel: 'exact', present: true, via: null }, 'exact');
  const worst = peerSearch.explain(
    { publicKey: 'K', publicLabel: 'unrelated-exact-ish', present: false, via: 3 }, 'exact');

  if (best.quality === 1 && worst.quality > 0 && worst.quality < 1) {
    test.check('a perfect row scores exactly 1.0; a poor one scores ' + worst.quality.toFixed(3));
  } else {
    test.fail('best=' + best.quality + ' worst=' + worst.quality);
  }

  // NORMALISED BY THE WEIGHTS PRESENT, so adding a signal does not
  // silently rescale every score that came before it.
  const weights = peerSearch.SIGNALS.reduce(function (n, sig) { return n + sig.weight; }, 0);
  const contributions = best.signals.reduce(function (n, sig) { return n + sig.contribution; }, 0);
  if (Math.abs(contributions / weights - best.quality) < 1e-9) {
    test.check('and the total is the weighted mean of the parts, not their sum');
  } else {
    test.fail(contributions + '/' + weights + ' != ' + best.quality);
  }
}

// ---------------------------------------------------------------------
test.subHeading('How much of the name the query accounts for');

{
  //   Andy: "the search string length versus the result-string-length is a
  //   cheap quality tester. if the search string length exceeds the result
  //   string length, the probability that the match is valuable might be
  //   extremely low."
  const rows = [
    row('ann'),                                  // 'ann' is all of it
    row('annabel'),
    row('annabella-cunningham-forsyth'),
  ];
  const got = labelsOf(peerSearch.search(rows, 'ann'));

  if (got.join(',') === 'ann,annabel,annabella-cunningham-forsyth') {
    test.check('three prefix matches order by how much of the name was typed');
  } else {
    test.fail('order: ' + got.join(', '));
  }

  // THE CASE ANDY NAMED IS UNREACHABLE, and the test says so rather than
  // pretending to cover it. He asked for query-longer-than-label to score
  // very low; once wildcard punctuation is stripped it cannot occur,
  // because a glob match maps every literal character of the pattern to a
  // distinct character of the label in order. A row that matched has a
  // label at least as long as the literal query — so the over-length
  // branch is dead code kept against a future fuzzier `rank`.
  const cov = function (label, query) {
    const e = peerSearch.explain({ publicKey: 'K', publicLabel: label }, query);
    if (!e.matched) return null;
    return e.signals.filter(function (x) { return x.name === 'coverage'; })[0].quality;
  };

  const overlong = [
    ['ab', 'a*b*c*d*e*f'],       // needs c..f, which `ab` has not
    ['a', 'ab*'],                // needs b
    ['abc', 'a?b?c?d'],          // needs seven positions
  ].filter(function (c) { return cov(c[0], c[1]) !== null; });

  if (overlong.length === 0) {
    test.check('a query with more literal characters than the label never matches at all');
  } else {
    test.fail('matched despite being longer: ' + JSON.stringify(overlong));
  }

  // So what the signal actually separates is BROAD from PRECISE, which is
  // the same intuition arriving from the reachable side.
  const broad = cov('abcdef', 'a*');
  const precise = cov('abcdef', 'a*b*c*d*e*f');
  if (broad < precise && precise === 1) {
    test.check('`a*` over a six-letter name scores ' + broad.toFixed(2) +
      ', a pattern naming every letter scores ' + precise.toFixed(2));
  } else {
    test.fail('broad=' + broad + ' precise=' + precise);
  }

  // WILDCARDS ARE PUNCTUATION, NOT EVIDENCE. `*a*` matches one character
  // and should be measured as one, or a precise wildcard is penalised for
  // its own syntax.
  const starred = peerSearch.explain({ publicKey: 'K', publicLabel: 'a' }, '*a*');
  const plain = peerSearch.explain({ publicKey: 'K', publicLabel: 'a' }, 'a');
  const sc = starred.signals.filter(function (x) { return x.name === 'coverage'; })[0];
  const pc = plain.signals.filter(function (x) { return x.name === 'coverage'; })[0];
  if (sc.quality === pc.quality && pc.quality === 1) {
    test.check('and `*a*` is measured as the one letter it matches, not three');
  } else {
    test.fail('starred=' + sc.quality + ' plain=' + pc.quality);
  }

  // It must not outrank the match itself: a full-coverage middle match is
  // still a worse answer than a partial prefix.
  const weak = peerSearch.explain({ publicKey: 'K', publicLabel: 'xax', present: false, via: null }, 'a');
  const strong = peerSearch.explain({ publicKey: 'K', publicLabel: 'annabel', present: false, via: null }, 'a');
  if (strong.quality > weak.quality) {
    test.check('but coverage never overtakes the match — a prefix still beats a middle');
  } else {
    test.fail('coverage outranked the match: ' + strong.quality + ' vs ' + weak.quality);
  }
}

// ---------------------------------------------------------------------
test.subHeading('How many of the words landed');

{
  //   Andy: "search string: 'one two three four' result string: 'six
  //   twelve four one' — we compute the combined length of full token
  //   matches against the length of the search string."
  //
  // one(3) + four(4) = 7 matched, against one+two+three+four = 15 typed.
  const e = peerSearch.explain(
    { publicKey: 'K', publicLabel: 'six twelve four one', present: false, via: null },
    'one two three four');
  const tok = e.signals.filter(function (x) { return x.name === 'tokens'; })[0];

  // 7 from whole words, plus PARTIAL credit for `two` inside `twelve`:
  // two characters shared, over a six-character result word, so
  // 2 x 2/6 = 0.667. Andy's layering — a query word is worth its length
  // when it IS the result word, and a fraction of that when it is merely
  // inside a longer one.
  const expected = (7 + 2 * (2 / 6)) / 15;
  if (Math.abs(tok.quality - expected) < 1e-9) {
    test.check('two whole words plus a partial: ' + tok.quality.toFixed(3) +
      ' = (3 + 4 + 0.67) of 15 typed');
  } else {
    test.fail('tokens scored ' + tok.quality + ', expected ' + expected);
  }

  // IT ONLY MATCHES AT ALL BECAUSE rank GREW A TIER. That query is not a
  // substring of that label; before tier 3 the row was simply absent, and
  // the signal could never have fired.
  // THE OBSERVABLE CLAIM, which is stronger than "rank === 3": the row is
  // in the results at all, and it would not be without the token tier
  // because the query is a substring of nothing.
  const someWords = found('six twelve four one', 'one two three four');
  const noWords = found('nine ten eleven', 'one two three four');
  if (someWords.matched && !noWords.matched) {
    test.check('some of the words is a result; none of them is not');
  } else {
    test.fail('scattered=' + someWords.matched + ' noWords=' + noWords.matched);
  }

  // A MULTISET, not a set. "john john" needs two johns to score twice.
  // Through the `tokens` signal: "john john" against one john scores a
  // fraction, against two johns it is whole. The second john gets no
  // WHOLE-word credit from `smith` — only the scraps partial matching
  // allows — so full credit needs a second real john.
  const once = signal('john smith', 'john john', 'tokens');
  const twice = signal('john john', 'john john', 'tokens');
  if (once < 1 && twice === 1) {
    test.check('a repeated word needs a repeat for full credit — ' +
      once.toFixed(2) + ' then ' + twice.toFixed(2));
  } else {
    test.fail('multiset: ' + once + ', ' + twice);
  }

  // SEPARATORS ARE PUNCTUATION. Somebody writing anna-marie and somebody
  // writing anna marie mean the same two words.
  // Through behaviour: a name written with any of them is the same name.
  // Asserting the splitter's array would be asserting the splitter.
  const written = ['anna-marie', 'anna.marie', 'anna_marie', 'anna marie'];
  const scores = written.map(function (w) { return signal(w, 'marie anna', 'tokens'); });
  const allWhole = scores.every(function (q) { return q === 1; });
  if (allWhole) {
    test.check('-, ., _ and space all separate words: every spelling scores 1.00');
  } else {
    test.fail('spellings differ: ' + written.map(function (w, i) {
      return w + '=' + scores[i];
    }).join(', '));
  }

  // THE TIER IS ONLY TRIED FOR A MULTI-TOKEN QUERY, because a single-token
  // one that matches a whole token is always already a substring match —
  // so the check could only cost a split per row and never change an
  // answer. This is the assertion that keeps a million rows cheap.
  // A one-word query is already a substring wherever it would be a whole
  // token, so the token path can add nothing. Observable as: the name that
  // STARTS with it beats the one that merely contains it, which is the
  // prefix rule and not the token rule.
  const starts = found('annabel smith', 'ann').quality;
  const inside = found('smith annabel', 'ann').quality;
  if (starts > inside) {
    test.check('a one-word query is decided by the prefix rule, not the token path: ' +
      starts.toFixed(3) + ' vs ' + inside.toFixed(3));
  } else {
    test.fail('single-token: ' + starts + ' vs ' + inside);
  }

  // AND IT IS THE WEAKEST TIER. Some of the words in any order is worse
  // than the whole query found somewhere.
  const scattered = peerSearch.explain(
    { publicKey: 'K', publicLabel: 'four one', present: false, via: null }, 'one two three four');
  const whole = peerSearch.explain(
    { publicKey: 'K', publicLabel: 'x one two three four x', present: false, via: null }, 'one two three four');
  if (whole.quality > scattered.quality) {
    test.check('the whole query found in order beats the same words scattered, ' +
      whole.quality.toFixed(3) + ' vs ' + scattered.quality.toFixed(3));
  } else {
    test.fail('scattered beat whole: ' + scattered.quality + ' vs ' + whole.quality);
  }
}

// ---------------------------------------------------------------------
test.subHeading('Partial words score, and the exact ones are taken first');

{
  //   Andy: "if the result token is shorter, its obviously no match; if
  //   the tokens are same that token's weight is 1.0; if the result token
  //   is longer, then the length of the longest matching substring
  //   compared to the length of the result-token determines its weight,
  //   and the matched length is added... at a reduced number."
  // Through the `tokens` signal, one query word against one result word,
  // so the fraction is the whole score. Same numbers, observed rather than
  // extracted.
  // PAIRED WITH A WORD THAT ANCHORS THE MATCH, and that too came from the
  // public surface. `two` alone against `twelve` is NOT A RESULT — a
  // one-word query that is not a substring never reaches the token path at
  // all, so scoring it in isolation was scoring something no search can
  // produce. With a second word the row is admitted and the partial credit
  // becomes observable, which is the only state it exists in.
  //
  // `x` matches whole in each, so what varies is the first word's share.
  const cases = [
    ['ann x', 'ann x', 1, 'the word itself is worth its length'],
    ['ann x', 'annabel x', (3 * (3 / 7) + 1) / 4, 'inside a longer word, reduced by its share of it'],
    ['two x', 'twelve x', (2 * (2 / 6) + 1) / 4, 'two shared characters of six'],
  ];
  const wrong = cases.filter(function (c) {
    const q = signal(c[1], c[0], 'tokens');
    return q === null || Math.abs(q - c[2]) > 1e-9;
  });
  if (wrong.length === 0) {
    test.check('one word against one word, graded — ' + cases.length + ' cases');
  } else {
    test.fail('wrong: ' + wrong.map(function (c) {
      return c[0] + '/' + c[1] + ' = ' + signal(c[1], c[0], 'tokens');
    }).join(', '));
  }

  // A SHORTER RESULT WORD IS NOT A PARTIAL MATCH, it is a different word.
  // `annabel` typed against the name `ann` finds nothing at all.
  if (!found('ann', 'annabel').matched) {
    test.check('and a name shorter than the word typed is not a match');
  } else {
    test.fail('ann matched the query annabel');
  }

  // THE BUG TWO PASSES EXIST FOR, and it is worth a check of its own
  // because one pass in query order looks perfectly reasonable.
  //
  // Query "one two three four" against "four one": in a single pass `two`
  // scores 0.25 against `four` on a shared "o", CONSUMES it, and the exact
  // `four` that follows finds an empty pool. Two of four words right
  // scored as one and a bit.
  // 7 of 15 typed characters land as whole words. In a single pass `two`
  // scored 0.25 against `four` on a shared "o", consumed it, and the exact
  // `four` that followed found an empty pool — 3.25 of 15.
  const q = signal('four one', 'one two three four', 'tokens');
  if (Math.abs(q - 7 / 15) < 1e-9) {
    test.check('a partial match cannot steal a word an exact match needs — ' +
      q.toFixed(3) + ', not ' + (3.25 / 15).toFixed(3));
  } else {
    test.fail('tokens scored ' + q + ' — pass order is wrong');
  }
}

// ---------------------------------------------------------------------
test.subHeading('Admission is about cost; the bucket is about quality');

{
  //   Andy: "there is no reason to not-admit, while the bucket isn't
  //   overflowing."
  //
  // So the gate stopped being whole-tokens-only. `annabel` for the query
  // `ann smith` is plainly worth seeing and was being refused outright.
  const annabel = peerSearch.explain(
    { publicKey: 'K', publicLabel: 'annabel', present: false, via: null }, 'ann smith');
  if (annabel.matched) {
    test.check('a word found inside a longer one is admitted, scoring ' +
      annabel.quality.toFixed(3));
  } else {
    test.fail('annabel refused for `ann smith`');
  }

  // What is still refused is "these two strings share a letter", which is
  // nearly everything — and every admitted row pays for a longest-run
  // search per token pair.
  const unrelated = peerSearch.explain(
    { publicKey: 'K', publicLabel: 'zebra', present: false, via: null }, 'ann smith');
  if (!unrelated.matched) {
    test.check('but a shared letter is not a result — the gate is what keeps a million rows cheap');
  } else {
    test.fail('zebra admitted for `ann smith`');
  }

  // AND QUALITY IS MEASURED ONCE PER ROW. A bucket compares a row O(log k)
  // times on its way to a seat; with a longest-run search inside the token
  // signal, recomputing per comparison is that many DP passes for one row.
  let calls = 0;
  const saved = peerSearch.SIGNALS[0];
  const realQuality = saved.quality;   // captured BEFORE the swap, or the spy calls itself
  peerSearch.SIGNALS[0] = Object.assign({}, saved, {
    quality: function (s) { calls++; return realQuality(s); },
  });
  const rows = [];
  for (let i = 0; i < 40; i++) rows.push(row('peer' + i));
  peerSearch.search(rows, 'peer');
  peerSearch.SIGNALS[0] = saved;

  if (calls <= rows.length) {
    test.check('quality is asked once per row, not once per comparison — ' +
      calls + ' for ' + rows.length + ' rows');
  } else {
    test.fail(calls + ' quality calls for ' + rows.length + ' rows');
  }
}

// ---------------------------------------------------------------------
test.subHeading('A weight can be argued about with numbers');

{
  // WHY explain() EXISTS. Quality-of-result is up in the air, so the
  // question "should presence count for more" has to be answerable by
  // looking at what a row actually scored rather than by reading the file.
  const near = peerSearch.explain(
    { publicKey: 'K1', publicLabel: 'zebra', present: false, via: null }, 'z');
  const live = peerSearch.explain(
    { publicKey: 'K2', publicLabel: 'buzz', present: true, via: null }, 'z');

  const byName = {};
  near.signals.forEach(function (sig) { byName[sig.name] = sig; });

  if (byName.match && byName.match.contribution > byName.present.weight) {
    test.check('the match outweighs presence entirely today — ' +
      'a prefix contributes ' + byName.match.contribution.toFixed(2) +
      ' against presence worth at most ' + byName.present.weight);
  } else {
    test.fail('match no longer dominates: ' + JSON.stringify(byName.match));
  }

  // Which is what keeps the old precedence behaviour: a present weaker
  // match does not overtake an absent stronger one. THE MOMENT A WEIGHT
  // MOVES this check is the one that will say so, which is the point.
  if (near.quality > live.quality) {
    test.check('so an absent prefix still beats a present middle-match, ' +
      near.quality.toFixed(3) + ' vs ' + live.quality.toFixed(3));
  } else {
    test.fail('weights now let presence overtake the match: ' +
      near.quality + ' vs ' + live.quality);
  }

  // A row that does not match at all is not scored low, it is absent.
  const no = peerSearch.explain({ publicKey: 'K', publicLabel: 'nothing' }, 'zzz');
  if (no.matched === false && no.quality === 0) {
    test.check('and a row that does not match is not a bad match, it is no match');
  } else {
    test.fail('unmatched scored ' + no.quality);
  }
}

// ---------------------------------------------------------------------
test.subHeading('And relay.js no longer has an opinion');

{
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'run', 'js', 'relay.js'), 'utf8')
    .split('\n')
    .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
    .join('\n');

  const leftovers = ['function globMatches', 'function matchRank', 'SEARCH_SLOTS =']
    .filter(function (s) { return src.indexOf(s) !== -1; });

  if (leftovers.length === 0) {
    test.check('the ranking, the matcher and the cap are all out of the relay');
  } else {
    test.fail('relay.js still holds: ' + leftovers.join(', '));
  }

  if (/require\('\.\/peerSearch'\)/.test(src)) {
    test.check('and it asks this module instead');
  } else {
    test.fail('relay.js does not require peerSearch');
  }
}

test.reportSuccessFailureCount();
