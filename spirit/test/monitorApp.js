'use strict';

// spirit/test/monitorApp.js
// THE MONITOR DRAWS A LEVER IT HAS NEVER HEARD OF.
//
//   Andy: "the selected relay's levers drawn generically from the report
//   — no lever named in code."
//
// `test/relayMonitor.js` is the traffic suite and predates this app; this
// one is about the app.
//
// ── WHAT IS ACTUALLY AT STAKE ────────────────────────────────────────
//
// 4.1 ships one lever. 4.2 adds `requestTimeout1`, and the pieces after
// it add more. If the app has to be edited for each, then "generic over
// levers" was a sentence rather than a property, and every future lever
// carries an app release with it.
//
// So the test invents a lever this tree has never contained, hands it to
// the app in a report, and requires it to be drawn correctly — bounds,
// last move, attribution and all — with no code change. It also greps
// the app for the one label that DOES exist, because an app that happens
// to work generically today and names a lever tomorrow fails silently.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

// The app's pure half, required directly: report in, rows out, no DOM.
// That split is what makes this assertable at all.
const APP = path.join(__dirname, '..', 'run', 'app', 'relayMonitor', 'relayMonitor.js');
const monitor = require(APP);

test.startTest('The Relay Monitor — generic over levers, or it is not generic');

test.subHeading('No lever is named in the app');

{
  const src = fs.readFileSync(APP, 'utf8');
  // The comments may discuss levers by name; the CODE may not. Strip
  // comment lines before looking, so the rule bites on behaviour rather
  // than on prose.
  const code = src.split('\n')
    .filter(function (line) { return !/^\s*(\/\/|\*|\/\*)/.test(line); })
    .join('\n');
  const named = ['connections1', 'requestTimeout1', 'connections'].filter(function (l) {
    return code.indexOf(l) !== -1;
  });
  if (!named.length) {
    test.check('no lever label appears in the app’s code — a new lever needs no app release');
  } else {
    test.fail('named in code: ' + named.join(', '));
  }
}

test.subHeading('A lever this tree has never contained is drawn correctly');

{
  // INVENTED. Nothing in spirit/ knows this label, and that is the point.
  const report = {
    at: '2026-09-20T14:02:33.000Z',
    levers: {
      wormholes7: {
        label: 'wormholes7', value: 12, floor: 3, ceiling: 40, settable: true, locked: false,
        lastMove: { from: 9, to: 12, why: 'heap 41%', by: 'programme', at: 1 }
      }
    }
  };

  const rows = monitor.leverRows(report);
  if (rows.length === 1 && rows[0].label === 'wormholes7') {
    test.check('it appears at all, with no code that knows its name');
  } else {
    test.fail('rows: ' + JSON.stringify(rows));
  }

  const r = rows[0];
  if (r.value === 12 && r.floor === 3 && r.ceiling === 40) {
    test.check('with its own bounds, read off the report rather than assumed');
  } else {
    test.fail('bounds lost: ' + JSON.stringify(r));
  }
  if (r.settable === true) {
    test.check('and a control, because the relay said it is live');
  } else {
    test.fail('a live lever got no control');
  }

  const line = monitor.leverLine(r);
  if (line.indexOf('wormholes7') !== -1 && line.indexOf('floor 3') !== -1 &&
      line.indexOf('heap 41%') !== -1 && line.indexOf('programme') !== -1) {
    test.check('the line says where it stands, what bounds it, and who moved it last');
  } else {
    test.fail('line: ' + line);
  }
}

test.subHeading('What the app refuses to draw');

{
  // NOT LIVE: a measurement to watch, not a control to offer. Drawing a
  // button here would be chrome whose every value is refused.
  const rows = monitor.leverRows({
    levers: { watching2: { label: 'watching2', value: 7, floor: 0, ceiling: 9, settable: false } }
  });
  if (rows[0] && rows[0].settable === false) {
    test.check('a lever that is not live gets no control, rather than one that would be refused');
  } else {
    test.fail('a dead lever was given a control');
  }
}

{
  // AN OLDER RELAY — AND THIS SHAPE IS NOT INVENTED. It is what
  // spirit.andyflinn.com actually sent on 2026-09-20, captured off the
  // wire while the work node ran 4.1 and the public relay ran the
  // release before it:
  //
  //   connections: { position: '12/12', allowed: 4096, floor: 1, ceiling: 4096 }
  //
  // The first version of this test guessed what "older" looked like and
  // guessed wrong in two ways: the real one carries its value under
  // `allowed`, not `value`, and its label is `connections` with no
  // iteration, which leverOk refuses. Both together made the app throw
  // away four usable numbers and print "this node cannot read that
  // lever" at an owner who was entitled to watch it.
  //
  //   Andy: "the test must account for version discrepancies, because
  //   that is established reality as soon as a certain level (alpha) is
  //   achieved in governor stability."
  const report = {
    at: '2026-09-20T14:40:02.000Z',
    levers: { connections: { position: '12/12', allowed: 4096, floor: 1, ceiling: 4096 } }
  };
  const rows = monitor.leverRows(report);
  const r = rows[0];

  if (r && r.drawable === true && r.value === 4096) {
    test.check('the previous release is DRAWN — its value rides under `allowed`');
  } else {
    test.fail('old shape not drawn: ' + JSON.stringify(r));
  }
  if (r && r.settable === false) {
    test.check('and gets no control: no `live`, and `connections` is not a lever name this rule accepts');
  } else {
    test.fail('an old-shape lever was given a control');
  }
  const line = monitor.leverLine(r);
  // Under 0015 NOTHING is settable, so saying so on every row would tell
  // the owner nothing. The absence of a control is the message; the line
  // carries where the lever stands and stops.
  if (line.indexOf('4096') !== -1 && line.indexOf('floor 1') !== -1 &&
      line.indexOf('does not take') === -1) {
    test.check('the line shows where it stands, and does not repeat the normal state at him');
  } else {
    test.fail('line: ' + line);
  }
}

{
  // A LEVER THIS NODE CANNOT READ — a bad label, or bounds that are not
  // numbers. The owner should see that the relay sent something
  // unreadable, not see nothing at all.
  const rows = monitor.leverRows({
    levers: { bad_one: { label: 'bad_one', value: 1, floor: 'x', ceiling: 2 } }
  });
  if (rows.length === 1 && rows[0].drawable === false && rows[0].settable === false) {
    test.check('a lever whose BOUNDS cannot be read says so — that is a different thing from old');
  } else {
    test.fail('unreadable lever: ' + JSON.stringify(rows));
  }
  if (monitor.leverLine(rows[0]).indexOf('cannot read') !== -1) {
    test.check('in words, rather than as a blank row');
  } else {
    test.fail('line: ' + monitor.leverLine(rows[0]));
  }
}

{
  // NOTHING AT ALL. "Said nothing yet" is not "said zero", and neither is
  // an exception.
  if (monitor.leverRows(null).length === 0 && monitor.leverRows({}).length === 0) {
    test.check('no report and an empty report both draw nothing, and neither throws');
  } else {
    test.fail('empty reports produced rows');
  }
}

test.subHeading('The capture time, when there is one');

{
  if (monitor.asOf({ at: '2026-09-20T14:02:33.000Z' }) === 'as of 14:02:33') {
    test.check('drawn as a time a person reads — so a stale view reads as stale');
  } else {
    test.fail('asOf: ' + monitor.asOf({ at: '2026-09-20T14:02:33.000Z' }));
  }
}

test.subHeading('Held by the owner is shown as such');

{
  const rows = monitor.leverRows({
    levers: {
      connections1: {
        label: 'connections1', value: 6, floor: 1, ceiling: 20, settable: true, locked: true,
        lastMove: { from: 20, to: 6, why: 'set by owner', by: 'owner', at: 1 }
      }
    }
  });
  const line = monitor.leverLine(rows[0]);
  if (rows[0].locked === true && line.indexOf('locked by owner') !== -1) {
    test.check('the owner can tell his own move from the programme’s, from a field rather than prose');
  } else {
    test.fail('held not shown: ' + line);
  }
  // The relay stamps a constant `why` on every owner setting, so printing
  // it beside a line that already says "set by owner" said the same thing
  // three times. The programme's reason differs every move and is kept.
  if (line.indexOf('(you)') !== -1 && line.split('locked by owner').length === 2) {
    test.check('and it is said once — the owner’s own move needs no reason printed back at him');
  } else {
    test.fail('the owner move repeats itself: ' + line);
  }
}

test.subHeading('The envelope is not the answer');

// This is here because it cost a live run. `api.verb` answers
// { status, text, body } — the envelope — and the app read `rows`
// straight off it, finding undefined, and then said truthfully and
// uselessly that the node owned no relay while it was holding two.
//
// The pure/DOM split made the DRAWING assertable and left the WIRING
// untested. This is the wiring, pulled out where a suite can reach it.
{
  const answer = { rows: [{ url: 'http://x', owned: true }], relayStatus: {} };

  if (monitor.answerOf({ status: 200, body: answer }) === answer) {
    test.check('a parsed body is taken as the answer');
  } else {
    test.fail('body was not used');
  }

  const fromText = monitor.answerOf({ status: 200, text: JSON.stringify(answer) });
  if (fromText && fromText.rows && fromText.rows[0].owned === true) {
    test.check('and `text` is parsed when there is no body — as natterDetails’ ndAsk does');
  } else {
    test.fail('text was not parsed: ' + JSON.stringify(fromText));
  }

  // THE FAILURE THAT ACTUALLY HAPPENED: the envelope handed on whole.
  const envelope = { status: 200, text: JSON.stringify(answer) };
  if (envelope.rows === undefined) {
    test.check('the envelope itself carries no `rows` — which is how the app came to see none');
  } else {
    test.fail('the envelope has rows, so this test proves nothing');
  }

  [null, undefined, { status: 500 }, { status: 200, text: 'not json' }].forEach(function (bad) {
    if (monitor.answerOf(bad) === null) {
      test.check('an unusable answer reads as nothing: ' + JSON.stringify(bad));
    } else {
      test.fail('answerOf accepted ' + JSON.stringify(bad));
    }
  });
}

test.subHeading('Where a relay’s key lives');

// The second wiring bug of the same afternoon, and the same shape as the
// first: a field invented rather than looked up. Apply answered "this
// node does not hold that relay's key" about a relay the node owns,
// because `row.relayKey` does not exist — natterDetails' ndRelayKey has
// carried the real answer since cycle 3.
{
  const fromRoll = { roll: { relayKey: 'ROLL_KEY' } };
  const report = { key: 'REPORT_KEY' };

  if (monitor.relayKey(fromRoll, report) === 'ROLL_KEY') {
    test.check('the roll copy wins — a plain member has it, where a report reaches the owner alone');
  } else {
    test.fail('roll was not preferred');
  }
  if (monitor.relayKey({}, report) === 'REPORT_KEY') {
    test.check('and the owner’s report is the fallback');
  } else {
    test.fail('report key not used');
  }
  if (monitor.relayKey({ relayKey: 'INVENTED' }, null) === '') {
    test.check('`row.relayKey` is not a field — the invention that caused this is pinned');
  } else {
    test.fail('row.relayKey was read as if it existed');
  }
  if (monitor.relayKey(null, null) === '' && monitor.relayKey({}, {}) === '') {
    test.check('and nothing at all reads as nothing, rather than as undefined');
  } else {
    test.fail('missing key did not read as empty');
  }
}

test.subHeading('Redlining, and what cannot be assessed');

// The threshold is the APP's on purpose: redlining is a drawing
// judgement — where should a person look — and a relay should have no
// opinion about that. Putting it in the relay would mean changing a
// relay to change what a screen highlights.
{
  const near = { drawable: true, value: 5, floor: 1, ceiling: 101, worseAt: 'floor' };
  const far = { drawable: true, value: 90, floor: 1, ceiling: 101, worseAt: 'floor' };
  const highBad = { drawable: true, value: 99, floor: 1, ceiling: 101, worseAt: 'ceiling' };

  if (monitor.redline(near) === 'red') {
    test.check('a lever near the end it calls worse is redlining');
  } else {
    test.fail('near the floor was not red: ' + monitor.redline(near));
  }
  if (monitor.redline(far) === 'ok') {
    test.check('and one far from it is not');
  } else {
    test.fail('far from the floor was red');
  }
  // THE SAME POSITION, THE OPPOSITE VERDICT. This is why the lever
  // declares worseAt and the app never guesses: value 99 of 101 is
  // comfortable on connections1 and critical on requestTimeout1.
  if (monitor.redline(highBad) === 'red' &&
      monitor.redline({ drawable: true, value: 99, floor: 1, ceiling: 101, worseAt: 'floor' }) === 'ok') {
    test.check('the same value reads opposite ways on levers with opposite worse ends');
  } else {
    test.fail('worseAt did not reverse the verdict');
  }

  // UNKNOWN IS NOT OK.
  if (monitor.redline({ drawable: true, value: 5, floor: 1, ceiling: 101 }) === 'unknown') {
    test.check('a lever that declares no worse end cannot be assessed — and does not read as fine');
  } else {
    test.fail('a lever with no worseAt was assessed anyway');
  }
}

test.subHeading('The All Relays summary ranks the worst first');

{
  const reports = {
    lab: { levers: {
      connections1: { label: 'connections1', value: 5, floor: 1, ceiling: 2048, worseAt: 'floor' },
      timeout1: { label: 'timeout1', value: 100, floor: 1, ceiling: 101, worseAt: 'ceiling' }
    } },
    quiet: { levers: {
      connections1: { label: 'connections1', value: 2000, floor: 1, ceiling: 2048, worseAt: 'floor' }
    } },
    // The previous release: no worseAt anywhere on it.
    old: { levers: { connections: { position: '12/12', allowed: 4096, floor: 1, ceiling: 4096 } } }
  };
  const mine = [{ url: 'quiet' }, { url: 'lab' }, { url: 'old' }];
  const sum = monitor.summary(mine, reports);

  if (sum.levers === 2 && sum.relays === 1) {
    test.check('two levers redlining, on one relay');
  } else {
    test.fail('summary: ' + JSON.stringify(sum));
  }
  if (sum.worst === 'lab' && sum.per[0].count === 2) {
    test.check('and the worst relay is named, ranked by how many');
  } else {
    test.fail('ranking wrong: ' + JSON.stringify(sum.per));
  }
  if (sum.per.every(function (x) { return x.count > 0; })) {
    test.check('a relay with nothing redlining is not in the list at all');
  } else {
    test.fail('a quiet relay was listed');
  }

  // THE OLDER RELAY IS COUNTED SEPARATELY, NOT AS HEALTHY. Version drift
  // in an alarm: a relay that cannot be assessed would otherwise sit
  // permanently fine in the one view whose job is to say where to look.
  if (sum.blind.levers === 1 && sum.blind.relays === 1) {
    test.check('and what cannot be assessed is counted apart, never folded into the healthy');
  } else {
    test.fail('blind count wrong: ' + JSON.stringify(sum.blind));
  }
}

{
  if (monitor.summary([], {}).levers === 0 && monitor.summary(null, null).relays === 0) {
    test.check('no relays summarises to nothing, and does not throw');
  } else {
    test.fail('empty summary misbehaved');
  }
}

test.subHeading('The headline counts one thing, not two');

// The first version of this sentence lied: with nothing redlining it
// printed the size of the WHOLE FLEET as the relay count, while the
// other branch printed relays that were actually redlining. Two
// populations under one sentence, and a number that means something
// different depending on which branch produced it.
//
//   Andy: "it should read: 0 on 0... I only want to direct attention to
//   where it's needed."
{
  const quiet = monitor.summary(
    [{ url: 'a' }, { url: 'b' }],
    { a: { levers: {} }, b: { levers: {} } }
  );
  if (monitor.headline(quiet) === 'red-lining levers: 0 on 0 relays') {
    test.check('nothing redlining reads 0 on 0 — never 0 on however many relays are fine');
  } else {
    test.fail('headline: ' + monitor.headline(quiet));
  }

  const one = { levers: 3, relays: 1 };
  if (monitor.headline(one) === 'red-lining levers: 3 on 1 relay') {
    test.check('and it counts relays that ARE redlining, singular where it should be');
  } else {
    test.fail('headline: ' + monitor.headline(one));
  }

  if (monitor.headline(null) === 'red-lining levers: 0 on 0 relays') {
    test.check('no summary at all still reads as nothing, rather than throwing');
  } else {
    test.fail('headline(null): ' + monitor.headline(null));
  }
}

test.reportSuccessFailureCount();
