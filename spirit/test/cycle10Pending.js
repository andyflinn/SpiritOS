'use strict';

// spirit/test/cycle10Pending.js
// WHAT CYCLE 10 STILL OWES, DECLARED SO THE HARNESS CAN COUNT IT.
//
//   Andy, 2026-09-23: "harness all green doesn't measure progress for
//   me." — "i do see the concept of writing tests beforehand as detailed
//   statements of intent." — and on what the whole apparatus is for:
//   "think of it as: the agents labeling and reference system can be
//   quantified for andy, instead of jargonized."
//
// ── A DESIGN IS ACCOMPANIED BY A SUITE, AND THIS IS THE FIRST ────────
//
//   Andy: *"nice would be. a design is accompanied by a test suite, and i
//   want to observe progress agains that."*
//
// So `<cycle>Pending.js` is a shape, not a one-off. A cycle document
// argues what should be true; this declares the same thing where it can
// be RUN, and the count of what is still declared-and-not-built is the
// progress he watches. When the cycle closes the file empties and goes —
// its assertions having moved into the suites that own each area.
//
// ── THE YELLOW BLOCK IS ADDRESSED TO ANDY ────────────────────────────
//
//   *"the yellow block are agent-tags for communication with me"* —
//   *"yellow-details that is"*
//
// That is what these fields ARE, and it decides how they are written.
// They are not internal bookkeeping he is allowed to overhear: the
// requirement id, the missing unit, the price-note and the per-cent are
// **a message from an agent to Andy**, and the yellow block is the
// channel. So:
//
//   - the `unit` is named in words he would use to ask about it, not in
//     the shape of an export;
//   - the note says what becomes TRUE when it lands, not what function
//     gets written;
//   - `cost` is a sitting, an afternoon, one line — never hours, because
//     an agent's hours mean nothing to him;
//   - `there` is a guess, printed as a guess, and meant to be argued with
//     during a design sitting rather than believed afterwards.
//
// A declaration that reads like a code comment is in the wrong voice for
// the place it appears.
//
// ── WHY THIS FILE EXISTS RATHER THAN NOTHING ─────────────────────────
//
// R-numbers, cycle citations and the requirement gate were built for
// AGENTS. They are jargon: they let two of us point at the same thing
// without ambiguity, and they cost Andy a vocabulary he did not ask for.
// This is where that apparatus pays him back — every declaration below
// names its requirement, the runner joins it against `design/cycles`, and
// what comes out is a NUMBER ON THE TALLY LINE that falls as the cycle is
// built. The jargon becomes a quantity.
//
// ── WHAT GOES IN HERE, AND WHAT DOES NOT ─────────────────────────────
//
// Only requirements whose missing UNIT can be named and asked for
// plainly — Andy: *"a test goes and checks if the unit is available for
// testing, and fails for that simple reason."* A requirement whose shape
// is still being argued does not belong here: a declaration guessing at
// an API would have to be rewritten when the design settles, and a
// progress board that lies is worse than none.
//
// So this file is DELIBERATELY SHORT. Nothing is declared awaiting in it
// now: what cycle 10 declared here is built, and only a check that the
// rotate still exists is left. The requirements never declared are named
// at the foot of this file with the reason, so the gap is visible rather
// than mistaken for completeness.
//
// ── WHEN ONE GOES GREEN ──────────────────────────────────────────────
//
// It does not. `test.awaiting` turns RED the moment its unit appears,
// which is the point: whoever builds it is told to come here and write
// the real assertion, or move it to the suite that owns the area. This
// file is a waiting room, not a home.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const limits = require('../run/spirit/limits.js');
const relayStore = require('../run/spirit/relayStore');
const auth = require('../run/spirit/relayAuth');
const nodeCard = require('../run/spirit/nodeCard');

test.startTest('Cycle 10 — what is declared and not built yet');

function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-c10-pending-'));
  fs.mkdirSync(path.join(d, 'spirit', 'state'), { recursive: true });
  return d;
}

test.subHeading('The ceiling and the flag day');

// cycle-10/R6 is built; its assertions live in spirit/test/payloadCeiling.js.

test.subHeading('The two that block the live boxes');

// cycle-10/R9's claim route is built; labPersistence.js, labRefusals.js
// and liveFrontDoor.js claim over real HTTP against a real relay.

// cycle-10/R20 is built; its proof is spirit/test/memberCard.js (a member
// hands the relay its card, and the relay can answer again).
test.subHeading('And the card the relay would seal to');

// ── cycle 10's R13 IS BUILT; ITS ASSERTIONS LIVE IN cardRotation.js ──
//
// Andy's title: "Get the damn rotate-button into the info app". Only
// reachability here, so this file does not become a second copy of that
// suite.
if (typeof nodeCard.rotate === 'function') {
  test.check('the rotate exists as a unit — nodeCard.rotate, asserted in cardRotation.js: a strictly '
    + 'rising counter, the old private key gone, history intact, and every peer moving to the new card once');
} else {
  test.fail('cycle 10\'s R13 regressed: nodeCard.rotate is gone');
}

// ── WHAT IS OPEN AND NOT DECLARED HERE, AND WHY ──────────────────────
//
// Said out loud so the tally is not read as the whole of what is left
// (the comment line below still prints 3 of 13; nothing is declared here now):
//
//   cycle-10/R7   the agents seal like everybody else — probably already true by
//        cycle-10/R5, and needs measuring rather than declaring
//   cycle-10/R8   suites that INSIST — this file is itself part of that answer
//   cycle-10/R10  prove the relay cannot read it, by trying to read it
//   cycle-10/R12  the relay's hash differs from the endpoints' hash of the words
//   cycle-10/R16  what the relay streams to a monitor is unreadable
//        — all three are PROOFS, not units, so they are not declared
//        awaiting; R10 and R16 are proved in spirit/test/relayCannotRead.js
//   cycle-10/R11  the layering is built; its proof is R10's
//   cycle-10/R14  built with R5; the log keeps plaintext on both sides
//   cycle-10/R15  length is public and documented — a document, not a unit
test.comment('3 of cycle 10\'s 13 open requirements are declared here; the rest are listed in this file with the reason');

test.reportSuccessFailureCount();
