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
        label: 'wormholes7', value: 12, floor: 3, ceiling: 40, live: true, held: false,
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
    levers: { watching2: { label: 'watching2', value: 7, floor: 0, ceiling: 9, live: false } }
  });
  if (rows[0] && rows[0].settable === false) {
    test.check('a lever that is not live gets no control, rather than one that would be refused');
  } else {
    test.fail('a dead lever was given a control');
  }
}

{
  // AN OLDER RELAY: no `live`, no `held`, no `at`. The app draws what is
  // there and marks the rest unknown — it does not invent, and it does
  // not fail.
  const report = {
    levers: { connections1: { label: 'connections1', value: 5, floor: 1, ceiling: 20 } }
  };
  const rows = monitor.leverRows(report);
  if (rows.length === 1 && rows[0].settable === false && rows[0].held === false) {
    test.check('a report missing `live` draws without a control rather than failing');
  } else {
    test.fail('older relay handled as: ' + JSON.stringify(rows));
  }
  if (monitor.asOf(report) === '') {
    test.check('and a report with no capture time shows none — never an invented one');
  } else {
    test.fail('asOf invented: ' + monitor.asOf(report));
  }
}

{
  // A LEVER THIS NODE CANNOT READ — a bad label, or bounds that are not
  // numbers. The owner should see that the relay sent something
  // unreadable, not see nothing at all.
  const rows = monitor.leverRows({
    levers: { bad_one: { label: 'bad_one', value: 1, floor: 'x', ceiling: 2 } }
  });
  if (rows.length === 1 && rows[0].readable === false && rows[0].settable === false) {
    test.check('an unreadable lever is still shown, and says it cannot be read');
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
        label: 'connections1', value: 6, floor: 1, ceiling: 20, live: true, held: true,
        lastMove: { from: 20, to: 6, why: 'set by owner', by: 'owner', at: 1 }
      }
    }
  });
  const line = monitor.leverLine(rows[0]);
  if (rows[0].held === true && line.indexOf('set by owner') !== -1 && line.indexOf('owner') !== -1) {
    test.check('the owner can tell his own move from the programme’s, from a field rather than prose');
  } else {
    test.fail('held not shown: ' + line);
  }
}

test.reportSuccessFailureCount();
