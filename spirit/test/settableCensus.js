'use strict';

// spirit/test/settableCensus.js
// NO LEVER IN THIS TREE IS SETTABLE BY THE OWNER. THE COUNT IS ZERO.
//
// Decision 0015: the Governor is the result of programming. The owner
// watches a lever move, and the RECORD of those moves is what changes the
// programme — observe, record, analyse, reprogram, with the owner's hand
// entering at reprogram rather than at runtime.
//
// ── WHY A CENSUS AND NOT A COMMENT ───────────────────────────────────
//
// The owner verb, its bounds checks, its shed remedy and its seventeen
// checks are all still here, proven and dormant. NODE-AND-RELAY:315
// specifies that path and cycle 4.1 built it correctly; 0015 supersedes
// the specification rather than correcting the work. Keeping it is cycle
// rule 6 — a marked seam rather than a temporary shape.
//
// But a dormant capability is a temptation, and this tree has already
// learned what happens to those:
//
//   AGENT.md: "There is no category meaning unlimited, because the first
//   version had one — server.js and kernel.js, 'structural' — and that is
//   precisely what got used."
//
// So the seam gets the guard the one-door census already gives every
// other temptation here. The number may go up only when Andy raises it,
// out loud and dated, which is what makes it a grant rather than a commit
// that happened to pass.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const lever = require('../run/js/lever');
const governorLib = require('../run/js/governor');

// THE NUMBER. Raising it is Andy granting an exception, never an agent
// noticing a red suite and adjusting it.
const SETTABLE_LEVERS = 0;

test.startTest('The settable census — how many levers the owner may move');

test.subHeading('What the tree actually builds');

{
  // Every lever a Governor reports, asked of the Governor rather than
  // read off a list — a list can be right while the code is not.
  const g = governorLib.createGovernor({ ramLimitMB: 128 });
  const levers = g.levers();
  const names = Object.keys(levers);

  const settable = names.filter(function (n) { return levers[n].settable === true; });

  if (settable.length === SETTABLE_LEVERS) {
    test.check('the Governor declares ' + SETTABLE_LEVERS + ' settable lever(s), of ' +
      names.length + ': ' + names.join(', '));
  } else {
    test.fail('settable levers: ' + settable.join(', ') +
      ' — the census says ' + SETTABLE_LEVERS + '. Raising it is Andy’s, out loud and dated (0015).');
  }
}

test.subHeading('And no configuration can change that answer');

{
  // THE OWNER'S GRANT IS REVOKED (Andy, 2026-09-20): "the code needs to
  // decide what is settable, some limits will be hardwired by design, a
  // software decision, not an owner's decision, i expect max_in_flight to
  // be one of them."
  //
  // The Governor used to read a list of lever names out of
  // relay-state/config.json, on the argument that the file is written by
  // a person with a shell and so naming a lever there was a grant. The
  // ruling is that this is the wrong question for a limit that holds the
  // design together: one an owner can widen is not a limit, it is a
  // default.
  //
  // WHAT WAS CUT IS THE WIRE, NOT THE PARAMETER. createGovernor still
  // takes `settable`, because a caller passing it is code deciding — a
  // line in relay.js or in a suite, reviewable in a diff, which is what
  // the ruling asks for. What is gone is relay.js reading it out of
  // relay-state/config.json, so the answer can no longer come from a file
  // on the box.
  //
  // This is therefore a SOURCE check and not a behaviour one: the only
  // way the owner's grant comes back is somebody rejoining that wire.
  const relaySrc = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'relay.js'), 'utf8');
  const code = relaySrc.split('\n')
    .filter(function (line) { return !/^\s*(\/\/|\*|\/\*)/.test(line); })
    .join('\n');

  if (!/config\s*\.\s*settable|settable\s*:\s*config\b/.test(code)) {
    test.check('relay.js reads no `settable` out of the configuration — the owner’s grant stays revoked');
  } else {
    test.fail('relay.js is reading config.settable again. Andy revoked that 2026-09-20: ' +
      '"the code needs to decide what is settable... a software decision, not an owner’s decision."');
  }

  // AND THE PRODUCTION CONSTRUCTOR PASSES NOTHING. `deps.settable` is the
  // code seam that replaced the config wire, so a suite can still prove
  // the owner verb works — but a relay anybody actually runs is built by
  // relayServer.js, and it must hand over no such list. Without this the
  // grant could come back by a shorter road than the one just closed.
  const serverSrc = fs.readFileSync(
    path.join(__dirname, '..', 'run', 'js', 'relayServer.js'), 'utf8');
  const serverCode = serverSrc.split('\n')
    .filter(function (line) { return !/^\s*(\/\/|\*|\/\*)/.test(line); })
    .join('\n');

  if (!/\bsettable\b/.test(serverCode)) {
    test.check('and relayServer.js passes none either — the relay you run has no settable lever');
  } else {
    test.fail('relayServer.js mentions `settable`, so a real relay may now have one.');
  }
}

test.subHeading('And what the source declares, so a second lever cannot slip in');

{
  // The census above asks a running Governor, which only sees levers a
  // Governor builds. This catches one built anywhere else.
  const RUN = path.join(__dirname, '..', 'run', 'js');
  const declared = [];
  fs.readdirSync(RUN).filter(function (f) { return f.endsWith('.js'); }).forEach(function (f) {
    const src = fs.readFileSync(path.join(RUN, f), 'utf8');
    const code = src.split('\n')
      .filter(function (line) { return !/^\s*(\/\/|\*|\/\*)/.test(line); })
      .join('\n');
    if (/settable\s*:\s*true/.test(code)) declared.push(f);
  });

  if (declared.length === SETTABLE_LEVERS) {
    test.check('no file under run/js declares `settable: true`');
  } else {
    test.fail('declares settable: ' + declared.join(', '));
  }
}

test.subHeading('The default is a denial, not a permission');

{
  // A lever that says nothing is not settable. The whole census rests on
  // this: if silence meant yes, every future lever would arrive settable
  // and the count would be a lie the moment somebody forgot a field.
  const quiet = lever.make('quiet1', { floor: 1, ceiling: 10 });
  if (quiet.settable === false) {
    test.check('a lever that declares nothing is not settable');
  } else {
    test.fail('silence was read as permission');
  }
  if (/takes no settings/.test(quiet.canSet(5))) {
    test.check('and it refuses a setting, in words rather than by ignoring it');
  } else {
    test.fail('a quiet lever accepted a setting');
  }

  const loud = lever.make('loud1', { floor: 1, ceiling: 10, settable: true });
  if (loud.settable === true && loud.canSet(5) === '') {
    test.check('and a lever that DOES declare it is settable — the path is proven, not removed');
  } else {
    test.fail('an explicitly settable lever was refused');
  }
}

test.subHeading('A report says nothing about settability unless it says so');

{
  // The same denial across the wire. An older relay sends no `settable`
  // at all, and reading that as permission would offer the owner a
  // control over a relay that has no verb to answer it.
  const view = lever.fromReport({ label: 'older1', value: 5, floor: 1, ceiling: 20 });
  if (view && view.settable === false) {
    test.check('a report with no `settable` field reads as not settable');
  } else {
    test.fail('a silent report was read as settable: ' + JSON.stringify(view));
  }
}

test.subHeading('settable gates the OWNER, never the programme');

// This is the bug that writing 0015 produced, kept as a check because it
// is the decision's own distinction and it is easy to get backwards:
// `settable: false` made canSet refuse EVERY mover, so the Governor
// could not move its own lever. A lever nothing can move is a constant,
// and a Governor with a constant is not a Governor.
//
// 0015: settable answers *may the owner move it* and says nothing about
// the programme.
{
  const l = lever.make('governed1', { floor: 1, ceiling: 10, value: 5 });

  if (l.canSet(8) !== '') {
    test.check('the owner is refused on a lever that is not settable');
  } else {
    test.fail('the owner was allowed to set a non-settable lever');
  }
  if (l.canSet(8, 'programme') === '') {
    test.check('and the programme is not — it must always be able to move a lever it owns');
  } else {
    test.fail('the programme was refused: ' + l.canSet(8, 'programme'));
  }

  const moved = l.set(8, 'heap 70%', 'programme');
  if (moved.ok && l.value === 8) {
    test.check('so a Governor tick lands, on a lever no owner may touch');
  } else {
    test.fail('the programme could not move it: ' + JSON.stringify(moved));
  }

  // And the bounds still hold for the programme. Ungated is not
  // unbounded — the floor and ceiling are the lever's own.
  if (!l.set(99, 'past the ceiling', 'programme').ok && l.value === 8) {
    test.check('and the bounds still hold: ungated is not unbounded');
  } else {
    test.fail('the programme was allowed past the ceiling');
  }
}

test.reportSuccessFailureCount();
