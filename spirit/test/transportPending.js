// ---------------------------------------------------------------------------
//  transportPending.js — the two requirements of the transport cycle that are
//  still open, declared so the board counts them.
//
//    Andy, 2026-09-26: "we also need to make sure this oustanding list has
//    suites waiting."
//
//  They had NEITHER a declaration NOR a stated reason. That is the gap this
//  file closes, and the distinction matters: cycle10Pending.js:165-181 leaves
//  five of its own open requirements undeclared ON PURPOSE and says why — "all
//  three are PROOFS Andy ruled must be run red first against today's tree;
//  declaring them as awaiting would hide the very red he asked to see." An
//  undeclared requirement with a written reason is a decision. An undeclared
//  requirement with no reason is an oversight, and these two were the second
//  kind for two weeks.
//
//  ── WHY A PENDING FILE FOR A CYCLE FROM 2026-09-12 ────────────────────
//
//  Because both gaps are still true of the tree today, checked rather than
//  assumed, and one of them Andy ruled on this week — he corrected the reply
//  heading himself, which is not something he would do to a dead
//  requirement.
//
//  THESE ASSERT ABSENCE AND NOTHING ELSE. Each goes red the moment somebody
//  builds the thing, which is the handover.
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const read = (rel) => {
  try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); }
  catch (e) { return ''; }
};

test.startTest('The transport cycle, what is still owed');

const shell = read('spirit/run/js/client/shell.js');
const answerRelay = read('spirit/run/js/answerRelay.js');
const trafficLog = read('spirit/run/js/trafficLog.js');
const peerPost = read('spirit/run/js/peerPost.js');

test.subHeading('the transport cycle R12 — an app can reply, and a reply is the only evidence of being delivered');

// ── THE HEADING SAID "read" UNTIL ANDY CORRECTED IT ───────────────────
//
//   Andy, 2026-09-26: "an app can reply, and a reply is the only evidence of
//   being DELIVERED" — and, of the mechanism: "the general patter is for apps
//   to reply with a receipt, it doesn't know if the shell (if awake) is even
//   attended."
//
// So what is owed is a RECEIPT, not a read mark. ROUTER.md's three states are
// not delivered / delivered / acted on, and a `seen` flag would have been two
// green checkmarks — a false positive dressed as precision and signed.
//
// TWO ABSENCES, MEASURED, and either one alone makes the reply impossible:
// deliverPackets discards the handler's return value, so an app has no way to
// say anything back; and answerRelay answers '' for everything that is not a
// device-offer, so the reply is empty even if an app produced one.
{
  const discards = /listeners\.slice\(\)\.forEach\(function \(fn\) \{ fn\(/.test(shell)
    && !/return\s+(?:fn|handlerResult|reply)/.test(shell);
  const onlyDeviceOffer = /device-offer/.test(answerRelay);
  test.awaiting('transport/R12', 'a handler return value that becomes the reply',
    !discards && !onlyDeviceOffer,
    'deliverPackets (client/shell.js) drops what a handler returns, and answerRelay.answer '
    + 'gives back an empty string for anything that is not a device-offer — so an app cannot '
    + 'say "I have it" even to itself. The receipt proves ARRIVAL AND HANDLING and must not '
    + 'claim a human looked: nothing on the wire can prove that, and a mechanism claiming to '
    + 'would be the two checkmarks this requirement exists to refuse',
    { there: 0, cost: 'a sitting — the value is the third state of ROUTER.md becoming reachable' });
}

test.subHeading('the transport cycle R16 — the log must be able to PROVE what it claims');

// ── THE CONDITION ON THE DATABASE DECISION ────────────────────────────
//
//   Andy, quoted in the cycle: "database decision deferred until proof that
//   the system in itself can verify its promises."
//
// Every packet arrives SIGNED. peerPost verifies the signature, acts on it,
// and never stores it — so `outcome: 'receipted'` is this node asserting
// something about itself, and an inbound row is a line it could equally have
// written for itself. A record nobody can check is a diary rather than
// evidence.
//
// AND IT GOT WORSE DELIBERATELY: under the ring the relay was a witness, and
// decision 0006 removed that on purpose, so the node's own log is the only
// record left.
{
  // Absence measured on the log's own writer rather than on a comment: does
  // any traffic row carry a signature at all?
  const storesSig = /\bsig\b\s*:/.test(trafficLog) || /sig:\s*(?:sig|signature)/.test(peerPost);
  test.awaiting('transport/R16', 'a signature stored beside what it signs',
    !storesSig,
    'trafficLog holds peer, hash and payload and no sig, so none of the three promises is '
    + 'provable: "bert sent me this" and "bert received mine" are both unverifiable, and '
    + '"bert acted on it" is unreachable until this cycle\'s R12. THE DATABASE DECISION IS '
    + 'BLOCKED ON THIS by Andy\'s own condition, so it is not a tidiness item',
    { there: 0, cost: 'a sitting, and it decides a deferred database question' });
}

test.reportSuccessFailureCount();
