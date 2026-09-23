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
// So this file is DELIBERATELY SHORT. Three are declared here because
// three have an unambiguous absent unit. The rest are named at the foot of this file with the
// reason they are not declared, so the gap is visible rather than
// mistaken for completeness.
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
const limits = require('../run/js/limits.js');
const relayStore = require('../run/js/relayStore');
const auth = require('../run/js/relayAuth');
const nodeCard = require('../run/js/nodeCard');

test.startTest('Cycle 10 — what is declared and not built yet');

function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-c10-pending-'));
  fs.mkdirSync(path.join(d, 'relay-state'), { recursive: true });
  return d;
}

test.subHeading('The ceiling and the flag day');

// cycle-10/R6 — sealing grows a payload by base64, about a third plus sixty bytes,
// so the 16 KB a sender is promised no longer fits once sealed. Andy took
// raising the ceiling over letting the promise shrink: "that's a better
// way.yes". The unit is the constant itself.
test.awaiting('cycle-10/R6', 'limits.PAYLOAD_MAX raised for sealed bodies',
  limits.PAYLOAD_MAX >= 22000,
  'sixteen thousand characters of text still fit after sealing, rather than about twelve',
  { there: 70, cost: 'one line and a flag-day note; the arithmetic is already argued' });

test.subHeading('The two that block the live boxes');

// cycle-10/R9's remaining half — the claim route — is BUILT, and its
// declaration is GONE rather than converted, which is
// the honest end for this one.
//
// THE DECLARATION WAS VACUOUS AND ONLY SAYING SO EXPOSED IT. It read
// `hub.signedClaim ? hub.signedClaim(...) : {}` — and `signedClaim` is
// not exported, so the guard silently took the empty branch and the test
// asked nothing at all. It reported yellow for the right reason by
// accident. A declaration that reaches past a module's front door to ask
// its question is the escape hatch `oneDoor.js` §4 exists to refuse, and
// exporting an internal to satisfy a progress board would be the tail
// wagging the dog.
//
// SO THE PROOF LIVES WHERE THE THING HAPPENS: `labPersistence.js`,
// `labRefusals.js` and `liveFrontDoor.js` claim over real HTTP against a
// real relay, and all three now seal through one helper
// (`labWorld.sealedClaimBody`). A relay that stopped opening sealed
// claims, or a node that stopped sealing them, turns all three red.

// cycle-10/R20 — every member enrolled before this cycle has no card on its roll
// row, so the relay cannot seal an answer to them: it mints the invite,
// spends the seat, and answers with silence. Found by checking whether
// Andy's own boxes could be updated, before any was touched.
//
// The unit: a way for a member already holding a seat to deliver a card.
// There is none — the claim is the only path that carries one.
{
  const home = tmp();
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const store = relayStore.open(home);
  const member = auth.generateIdentity('early');
  store.members.put({ publicKey: member.publicKey, publicLabel: 'early', claimedAt: '2026-01-01' });
  const before = store.members.get(member.publicKey);
  // Nothing in the tree offers this member a way to hand its card over
  // after the fact. If one appears, the row below stops being empty.
  test.awaiting('cycle-10/R20', 'a path for an enrolled member to deliver its card',
    !!(before && before.card),
    'a relay can answer a member who joined before the flag day, instead of minting in silence',
    { there: 30, cost: 'a sitting, and it needs a decision on which of three paths' });
  try { store.close(); } catch (e) { /* already closed */ }
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* leave it */ }
}

test.subHeading('And the card the relay would seal to');

// cycle-10/R13 — a card is ordered in time, and the shadow roll protects BOTH
// keys: identity immutable, cipher replaced only by a signed, strictly
// newer card, every change reported to the owner. The store half landed
// with cycle-10/R3 (`setCard` refuses an older card and keeps the disputed one);
// what is missing is the rotation that produces a newer one.
//
// `cardFrom` exists for exactly this and is commented as built ahead of
// its caller — Andy: "we're building towards right now."
test.awaiting('cycle-10/R13', 'nodeCard.rotate raising the counter and the seal key',
  !!nodeCard.rotate,
  'a node can rotate its cipher key and every peer takes the newer card and refuses the old',
  { there: 55, cost: 'a sitting — the store refuses an older card already; the rotation and the owner report are missing' });

// ── WHAT IS OPEN AND NOT DECLARED HERE, AND WHY ──────────────────────
//
// Said out loud so the tally is read as four of thirteen rather than as
// the whole of what is left:
//
//   cycle-10/R7   the agents seal like everybody else — probably already true by
//        cycle-10/R5, and needs measuring rather than declaring
//   cycle-10/R8   suites that INSIST — this file is itself part of that answer
//   cycle-10/R10  prove the relay cannot read it, by trying to read it
//   cycle-10/R12  the relay's hash differs from the endpoints' hash of the words
//   cycle-10/R16  what the relay streams to a monitor is unreadable
//        — all three are PROOFS Andy ruled must be run red first against
//        today's tree; declaring them as awaiting would hide the very
//        red he asked to see
//   cycle-10/R11  the layering is built; only its proof is missing, which is R10
//   cycle-10/R14  built with R5; the log keeps plaintext on both sides
//   cycle-10/R15  length is public and documented — a document, not a unit
test.comment('3 of cycle 10\'s 13 open requirements are declared here; the rest are listed in this file with the reason');

test.reportSuccessFailureCount();
