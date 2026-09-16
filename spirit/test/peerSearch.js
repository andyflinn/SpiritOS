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

test.startTest('Graded search — isolated, and driven with nothing running');

// ---------------------------------------------------------------------
test.subHeading('It stands alone');

{
  // THE ISOLATION IS THE FEATURE, so it is asserted rather than assumed.
  // A require() that pulls in relay.js, fs or a socket would make every
  // quality question below cost a lab run to answer.
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'run', 'js', 'peerSearch.js'), 'utf8')
    .split('\n')
    .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
    .join('\n');

  const requires = (src.match(/require\([^)]*\)/g) || []);
  if (requires.length === 1 && /bucket/.test(requires[0])) {
    test.check('peerSearch requires only js/bucket.js — no relay, no fs, no clock, no socket');
  } else {
    test.fail('dependencies: ' + (requires.join(', ') || 'none') +
      ' — the opinion may depend on the mechanism and nothing else');
  }

  // Presence as a FIELD, not a function. Taking `isPresent` would drag the
  // relay's live socket state in through the back door and make every test
  // here stand up a registry to answer it.
  if (!/isPresent/.test(src)) {
    test.check('and reads presence off the row rather than asking anybody');
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

  if (got.indexOf('anderson') < got.indexOf('andrew')) {
    test.check('and two prefixes fall back to the label, so the order is stable');
  } else {
    test.fail('tie not broken by label: ' + got.join(', '));
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
  const cases = [
    ['a*c', 'abc', true], ['a*c', 'ac', true], ['a*c', 'abd', false],
    ['a?c', 'abc', true], ['a?c', 'ac', false],
    ['*', 'anything', true], ['**', 'anything', true],
    ['abc', 'abc', true], ['abc', 'abcd', false],
  ];
  const wrong = cases.filter(function (c) {
    return peerSearch.globMatches(c[1], c[0]) !== c[2];
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
  peerSearch.globMatches(long, evil);
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
test.subHeading('The signals are named, so the next one is an entry');

{
  // Quality-of-result is up in the air (Andy), so what `order` compares
  // and in what sequence is data rather than a comparator to be read.
  // A new signal — activity, live percentage, how often somebody actually
  // answered — is a row in SIGNALS with its own check here, and nothing
  // above or below it moves.
  const names = peerSearch.SIGNALS.map(function (s) { return s.name; });
  if (names[0] === 'rank') {
    test.check('rank is asked first: ' + names.join(' > '));
  } else {
    test.fail('signals: ' + names.join(', '));
  }

  const allNamed = peerSearch.SIGNALS.every(function (s) {
    return s.name && typeof s.of === 'function';
  });
  if (allNamed) {
    test.check('and every signal is named and answers a number');
  } else {
    test.fail('an unnamed signal is in the list');
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
