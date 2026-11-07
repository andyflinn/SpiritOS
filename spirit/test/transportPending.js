// ---------------------------------------------------------------------------
//  transportPending.js — the two requirements of the transport cycle that are
//  still open, declared so the board counts them.
//
//    Andy, 2026-09-26: "we also need to make sure this oustanding list has
//    suites waiting."
//
//  An undeclared requirement with a written reason is a decision (as
//  cycle10Pending.js's foot list is); one with no reason is an oversight. So
//  these two are declared. Both gaps are checked against the tree on every
//  run, not assumed.
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

const shell = read('spirit/run/spirit/client/shell.js');
const server = read('spirit/run/spirit/server.js');
const trafficLog = read('spirit/run/spirit/trafficLog.js');

test.subHeading('the transport cycle R12 — an app can reply, and a reply is the only evidence of being delivered');

// ── A RECEIPT, NOT A READ MARK ────────────────────────────────────────
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
// say anything back; and the node wires no `answer` into peerPost
// (server.js), so the reply is empty even if an app produced one.
{
  const discards = /listeners\.slice\(\)\.forEach\(function \(fn\) \{ fn\(/.test(shell)
    && !/return\s+(?:fn|handlerResult|reply)/.test(shell);
  const noAnswer = !/^\s*answer:\s*\S/m.test(server);
  test.awaiting('transport/R12', 'a handler return value that becomes the reply',
    !discards && !noAnswer,
    'deliverPackets (client/shell.js) drops what a handler returns, and server.js hands '
    + 'peerPost no `answer` at all — so an app cannot '
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
  // Absence measured on the LOG'S OWN WRITER: does trafficLog ever put a
  // signature into a row? (Not peerPost: its outgoing post body carries a
  // `sig`, which is sending a signature rather than storing one.)
  const storesSig = /\bsig\s*:/.test(trafficLog);
  test.awaiting('transport/R16', 'a signature stored beside what it signs',
    storesSig,
    'trafficLog holds peer, hash and payload and no sig, so none of the three promises is '
    + 'provable: "bert sent me this" and "bert received mine" are both unverifiable, and '
    + '"bert acted on it" is unreachable until this cycle\'s R12. THE DATABASE DECISION IS '
    + 'BLOCKED ON THIS by Andy\'s own condition, so it is not a tidiness item',
    { there: 0, cost: 'a sitting, and it decides a deferred database question' });
}

test.reportSuccessFailureCount();
