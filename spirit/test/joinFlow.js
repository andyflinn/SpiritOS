'use strict';

// spirit/test/joinFlow.js
// CYCLE 12 — THE ENROLMENT SITE, ASSERTED FROM THE DOCUMENT.
//
//   Andy: "the real first try" of the working agreement.
//
// Written by wsl-claude from design/cycles/2026-09-24-join-cycle-12.md
// and from nothing else: the Windows Claude owns the source and neither
// of us reads the other until the close. A suite written from an
// implementation can only describe it.
//
// MOST OF THIS IS DECLARED RATHER THAN ASSERTED, because `join/` does not
// exist yet and a test written before the code cannot test behaviour — it
// tests presence (ANDYS_RULES_FOR_AGENTS.md, the SOP). Each declaration
// names the unit that would make it real and what the guess counts.
//
// TWO THINGS CAN BE ASSERTED TODAY AND ARE, because they are about what
// this cycle promises NOT to do, and a promise nobody checks is a wish:
// the relay is not touched, and the claim route is not touched. Those two
// are green now and turn red the moment either stops being true, which is
// the only way a "no change" requirement can be held.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const OPENED_AT = '5cd0b12';   // the commit the cycle document measured
const JOIN = path.join(REPO, 'join');

function atOpening(rel) {
  try {
    return String(execFileSync('git', ['-C', REPO, 'show', OPENED_AT + ':' + rel], { encoding: 'utf8' }));
  } catch (e) { return null; }
}

function now(rel) {
  try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); }
  catch (e) { return null; }
}

function filesUnder(dir) {
  const out = [];
  (function walk(d) {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    entries.forEach(function (e) {
      if (e.name === 'relay-state' || e.name === 'node_modules' || e.name === '.git') return;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(p);
    });
  }(dir));
  return out;
}

const joinExists = fs.existsSync(JOIN);

test.startTest('Cycle 12 — the enrolment site, from the document');

// ── WHAT THE CYCLE PROMISES NOT TO DO ────────────────────────────────
//
// "No relay change. A cycle-12 commit touching relay.js is a signal that
// something was mis-designed, not progress." That is the strongest claim
// in the document — the whole architecture rests on the relay already
// being enough — and nothing was asserting it.
test.subHeading('cycle 12 R6 and its own "what this cycle does not do" — the relay is not touched');
[['spirit/run/js/relay.js', 'the relay'],
 ['spirit/run/js/relayServer.js', 'the relay door']].forEach(function (pair) {
  const was = atOpening(pair[0]);
  const is = now(pair[0]);
  if (was === null) {
    test.fail('could not read ' + pair[0] + ' at ' + OPENED_AT + ' — this guard cannot see what it guards');
  } else if (was === is) {
    test.check(pair[1] + ' is byte-identical to ' + OPENED_AT + ' — ' + pair[0]);
  } else {
    test.fail(pair[1] + ' CHANGED during cycle 12 (' + pair[0] + '). The document calls that "a signal that ' +
      'something was mis-designed, not progress" — read the diff before reading this suite');
  }
});

// cycle 12 R10 says the claim route is unchanged and only the SCREEN moves. The
// route is the thing a stranger's node talks to, so it is asserted apart
// from the rest of the relay: a screen change that quietly needed a route
// change is exactly what this catches.
test.subHeading('cycle 12 R10 — the claim route is untouched; only the screen collapses');
{
  const was = atOpening('spirit/run/js/relayServer.js');
  const claimNow = now('spirit/run/js/relayServer.js');
  const route = /\/api\/relay\/claim/;
  if (was && claimNow && route.test(was) && route.test(claimNow)) {
    test.check('/api/relay/claim exists at the opening commit and still exists — a screen change that needed a route change would show here');
  } else {
    test.fail('the claim route is not where the document says it is');
  }
}

// ── THE DOCUMENT THIS SUITE WAS WRITTEN FROM IS BEING REPLACED ───────
//
// Cycle 12 was redesigned in a sitting on 2026-09-24: join/ as a
// directory is gone, the site is not a separate node story, and the
// third startup module is a PUBLIC APP SERVER — the companion to the
// shell — with join as its first public app rather than the mode
// itself. Several of R1-R11 no longer exist.
//
// THE TWELVE DECLARATIONS THAT STOOD HERE ARE REMOVED RATHER THAN LEFT
// TO ROT. A board showing twelve items waiting on a dead specification
// is worse than a board showing none: it reports work nobody is going
// to do, and it is exactly the rot the awaiting mechanism was built to
// prevent. The assertions above survive because they are about what the
// cycle promises NOT to do, and that promise did not move.
//
// This is the SPEC MOVING, not a divergence: no reading of mine was
// wrong and nobody yielded. It is recorded here because the next reader
// will otherwise wonder why a cycle-12 suite asserts two things and
// declares one.
test.awaiting('cycle-12/R1', 'the rewritten cycle 12 document', false,
  'the suite follows the document: when the new one lands, these become declarations again and then assertions',
  { there: 0, cost: 'the document is being rewritten; this suite is deliberately empty of requirement claims until it exists' });
test.reportSuccessFailureCount();
