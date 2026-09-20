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

test.subHeading('set is the only mutator, and it records why');

{
  const l = lever.make('connections1', { floor: 2, ceiling: 12, value: 4 });

  if (l.value === 4) {
    test.check('it starts where it was built');
  } else {
    test.fail('started at ' + l.value);
  }

  const r = l.set(9, 'set by owner');
  const m = l.lastMove();
  if (r.ok && l.value === 9 && m && m.from === 4 && m.to === 9 && m.why === 'set by owner') {
    test.check('a move carries from, to and why — which is how the owner tells his move from the Governor\'s');
  } else {
    test.fail('move not recorded: ' + JSON.stringify(m));
  }

  if (m && typeof m.at === 'number' && m.at > 0) {
    test.check('and when it happened');
  } else {
    test.fail('no capture time on the move');
  }

  // The value is a getter with no setter behind it, so in strict mode a
  // write THROWS rather than being quietly dropped. That is the stronger
  // of the two: a second write path is a move that happens with no `why`
  // attached, and one that fails silently is a move the owner cannot see
  // did not happen.
  let threw = false;
  try { l.value = 999; } catch (e) { threw = true; }
  if (threw && l.value === 9) {
    test.check('writing the value around `set` throws, and the value stands');
  } else {
    test.fail('the value was written directly: ' + l.value + ' (threw: ' + threw + ')');
  }
}

test.subHeading('canSet says why, and set never leaves the bounds');

{
  const l = lever.make('connections1', { floor: 2, ceiling: 12, value: 4 });

  [[1, 'floor'], [13, 'ceiling'], ['seven', 'whole number'], [2.5, 'whole number']].forEach(function (c) {
    const why = l.canSet(c[0]);
    if (why && why.indexOf(c[1]) !== -1) {
      test.check('refused with a reason a person can act on: ' + JSON.stringify(c[0]) + ' → ' + why);
    } else {
      test.fail('canSet(' + JSON.stringify(c[0]) + ') said ' + JSON.stringify(why));
    }
    const before = l.value;
    const res = l.set(c[0], 'should not apply');
    if (!res.ok && l.value === before) {
      test.check('and the value did not move');
    } else {
      test.fail('a refused set moved the value to ' + l.value);
    }
  });

  [2, 12].forEach(function (v) {
    if (l.canSet(v) === '') {
      test.check('the bounds themselves are allowed: ' + v);
    } else {
      test.fail('the bound ' + v + ' was refused');
    }
  });

  if (l.canSet(lever.DYNAMIC) === '') {
    test.check('`dynamic` is always settable on a live lever — it is how the owner hands it back');
  } else {
    test.fail('dynamic was refused');
  }
}

test.subHeading('A lever that is not live reports itself and takes nothing');

{
  const l = lever.make('watching1', { floor: 0, ceiling: 100, value: 7, live: false });
  const why = l.canSet(50);
  if (why && /takes no settings/.test(why)) {
    test.check('it refuses a setting, and says so rather than failing silently');
  } else {
    test.fail('a dead lever accepted a setting: ' + JSON.stringify(why));
  }
  if (l.readOut().live === false) {
    test.check('and it says so in the report, so an app draws no control it would refuse');
  } else {
    test.fail('readOut did not carry live:false');
  }
}

test.subHeading('readOut → fromReport: an app can draw a lever it never heard of');

{
  const l = lever.make('inventedThing3', { floor: 5, ceiling: 50, value: 20 });
  l.set(30, 'by the programme');

  // Across the wire: JSON is the only thing that crosses, so the round
  // trip is asserted through it rather than through the object.
  const wire = JSON.parse(JSON.stringify(l.readOut()));
  const view = lever.fromReport(wire);

  if (view && view.label === 'inventedThing3' && view.value === 30 &&
      view.floor === 5 && view.ceiling === 50 && view.live === true) {
    test.check('everything needed to draw it survives the wire, with no lever named in the app');
  } else {
    test.fail('round trip lost something: ' + JSON.stringify(view));
  }

  if (view && view.lastMove && view.lastMove.why === 'by the programme') {
    test.check('including who moved it last and why');
  } else {
    test.fail('the last move did not survive');
  }

  if (view && view.canSet(4) && view.canSet(20) === '') {
    test.check('and the node checks the same bounds the relay will — before taxing the wire');
  } else {
    test.fail('the node view does not enforce the relay bounds');
  }

  // The node view is deliberately NOT a lever: nothing on the node may
  // move a relay's value except by asking the relay.
  if (typeof view.set === 'undefined') {
    test.check('the node view has no `set` — a local move would draw a value the relay never took');
  } else {
    test.fail('fromReport handed back a mutator');
  }
}

{
  [null, undefined, {}, { label: 'conn_1', floor: 1, ceiling: 2 },
   { label: 'connections1', floor: 'x', ceiling: 2 }].forEach(function (bad) {
    if (lever.fromReport(bad) === null) {
      test.check('a report it cannot trust reads as nothing: ' + JSON.stringify(bad));
    } else {
      test.fail('fromReport accepted ' + JSON.stringify(bad));
    }
  });
}

test.reportSuccessFailureCount();
