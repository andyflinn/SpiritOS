'use strict';

// spirit/test/lever.js
// A LEVER'S NAME, AND THE ONE WAY ITS VALUE MOVES.
//
//   Andy: "the naming convention for levers should include meaning001
//   (meaning and iteration) which still should fit the label naming
//   constraints."
//   Andy: "the meaning is restricted no a-z or A-Z the iteration is a
//   subgroup: the shortest 0-9 representation of an actual positive
//   integer."
//   Andy: "Every proposed lever must define floor and ceiling
//   considerations."
//
// The claim this file makes is not "these strings are allowed". It is
// that a lever can be drawn by an app that has never heard of it — which
// only holds if every lever describes itself the same way, and if the
// only thing that can move a value also records why it moved.

const test = require('./testSupport.js');
const rule = require('../run/js/labelRule');
const lever = require('../run/js/lever');

test.startTest('A lever — its name, its bounds, and the one mutator');

test.subHeading('The name: a meaning in letters, then an iteration');

if (rule.leverOk('connections1')) {
  test.check('`connections1` is a name: a meaning, then an iteration');
} else {
  test.fail('connections1 was refused');
}

if (rule.leverOk('requestTimeout1')) {
  test.check('the meaning spells its parts in case, not punctuation — `requestTimeout1`');
} else {
  test.fail('requestTimeout1 was refused');
}

// Andy, asked how `ipv4` could be a meaning: "it's the uppercase
// letters." So the digits at the end are ALWAYS the iteration. `ipv41`
// is legal and means `ipv` iteration 41 — which is not what someone
// typing it intends, and the rule does not pretend to catch that. It is
// asserted here so the trap is recorded rather than rediscovered.
if (rule.leverOk('ipv41')) {
  test.check('`ipv41` is legal and means `ipv` iteration 41 — the digits are never the meaning');
} else {
  test.fail('ipv41 was refused: the trailing digits must always read as the iteration');
}

[
  ['conn_1', 'a separator — a second way to say the same thing'],
  ['connections01', 'a leading zero — one integer must have one spelling'],
  ['connections0', 'zero — the iteration is a positive integer'],
  ['connections', 'no iteration at all'],
  ['1connections', 'the meaning must come first'],
  ['connections 1', 'a space — not a spoken word either'],
  ['', 'empty'],
  ['c'.repeat(33) + '1', '34 characters — past the spoken bound of 32']
].forEach(function (pair) {
  if (!rule.leverOk(pair[0])) {
    test.check('refused, ' + pair[1] + ': ' + JSON.stringify(pair[0]));
  } else {
    test.fail('accepted ' + JSON.stringify(pair[0]) + ' — ' + pair[1]);
  }
});

// The layering is the point, not an implementation detail: if the spoken
// rule ever tightens, this follows it without being edited.
if (!rule.leverOk('connections1'.toUpperCase() + '!')) {
  test.check('the lever rule sits ON the spoken rule — what spokenOk refuses, leverOk refuses');
} else {
  test.fail('a character spokenOk refuses was accepted as a lever name');
}

test.subHeading('make refuses what it cannot report honestly');

[
  ['conn_1', { floor: 1, ceiling: 10 }, 'a bad label'],
  ['connections1', { floor: 10, ceiling: 1 }, 'floor above ceiling'],
  ['connections1', { floor: 1 }, 'no ceiling'],
  ['connections1', { floor: 1.5, ceiling: 10 }, 'a fractional bound']
].forEach(function (c) {
  let threw = false;
  try { lever.make(c[0], c[1]); } catch (e) { threw = true; }
  if (threw) {
    test.check('refused at construction, ' + c[2]);
  } else {
    test.fail('built a lever with ' + c[2]);
  }
});

test.subHeading('A gauge cannot move — cycle 8, the Governor deleted');

{
  //   Andy: "relay will self-manage within fixed/constant limits." — and
  //   Grok: "Levers kept 'for later' grow a governor back." So there is no
  //   setter to grow one from.
  const g = lever.make('connections1', { floor: 1, ceiling: 256, value: 256, worseAt: 'floor' });
  if (typeof g.set === 'undefined' && typeof g.canSet === 'undefined') {
    test.check('a gauge has no set and no canSet — nothing can move it after boot');
  } else {
    test.fail('a gauge still has a mutator');
  }
  let changed = false;
  try { g.value = 3; } catch (e) { /* frozen, in strict mode */ }
  changed = g.value !== 256;
  if (!changed && Object.isFrozen(g)) {
    test.check('and it is frozen: assigning to its value changes nothing');
  } else {
    test.fail('the gauge value moved to ' + g.value);
  }
  let threw = false;
  try { lever.make('connections1', { floor: 1, ceiling: 10, value: 11 }); } catch (e) { threw = true; }
  if (threw) {
    test.check('a value outside its own floor and ceiling is refused at construction');
  } else {
    test.fail('built a gauge reading above its ceiling');
  }
  if (lever.DYNAMIC === undefined) {
    test.check('and "dynamic" — the owner handing a lever back to the Governor — is gone with it');
  } else {
    test.fail('lever.DYNAMIC survived');
  }
}

test.subHeading('readOut → fromReport: the monitor draws a gauge it never heard of');

{
  const g = lever.make('connections1', { floor: 1, ceiling: 256, value: 256, worseAt: 'floor' });
  const out = g.readOut();
  if (out.label === 'connections1' && out.value === 256 && out.floor === 1 && out.ceiling === 256 &&
      out.worseAt === 'floor' && out.settable === false && out.locked === false && out.lastMove === null) {
    test.check("the report keeps the lever's field names, settable false, locked false, no last move — so the monitor needed no change");
  } else {
    test.fail('readOut: ' + JSON.stringify(out));
  }
  const view = lever.fromReport(JSON.parse(JSON.stringify(out)));
  if (view && view.value === 256 && view.ceiling === 256 && view.settable === false && typeof view.canSet === 'undefined') {
    test.check('and the monitor rebuilds it from the wire as a view it can draw and never move');
  } else {
    test.fail('fromReport: ' + JSON.stringify(view));
  }
  [null, {}, { label: 'x', floor: 1, ceiling: 2 }, { label: 'connections1', floor: 5, ceiling: 1 }].forEach(function (bad) {
    if (lever.fromReport(bad) === null) {
      test.check('a report it cannot trust reads as nothing: ' + JSON.stringify(bad));
    } else {
      test.fail('fromReport accepted ' + JSON.stringify(bad));
    }
  });
}

test.reportSuccessFailureCount();
