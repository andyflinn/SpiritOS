'use strict';

// spirit/test/harnessRetry.js
// WHEN A CALL TO labMaster MAY BE SENT TWICE, AND WHEN IT MAY NOT.
//
// The runner starts one labMaster and every lab suite is a client of it,
// six suites at a time. It spawns and stops real node processes, so it
// has moments where it is not accepting connections — and a single
// refused connect used to fail a whole suite: labLifecycle went red as
// "start relay: 0 fetch failed", losing checks to a service that was
// merely busy. Measured at one red in three full runs on Windows, and
// once in three independently in the WSL checkout (2026-09-21).
//
// ── WHY THIS SUITE IS ABOUT THE PREDICATE AND NOT THE RACE ───────────
//
// A race cannot be provoked on demand, and a suite claiming to prove one
// fixed would be asserting against a fixture rather than against the
// race. What CAN be pinned is the decision the fix rests on, and it is
// the half where a mistake is expensive:
//
//   These calls are NOT idempotent. `POST /api/nodes` creates a node.
//
// So a request that may have ARRIVED must never be sent again. Exactly
// one failure proves nothing was accepted — the connection was refused:
// no socket, no read, nothing at the far end to have acted on it. A reset
// or a hang-up mid-response could mean the opposite, and an HTTP status
// is an answer rather than a failure.

const test = require('./testSupport.js');
const lab = require('./labMaster/ensureMaster.js');

test.startTest('Retrying labMaster — only when nothing can have arrived');

test.subHeading('A refused connection is the one safe case');

{
  const refused = { cause: { code: 'ECONNREFUSED' } };
  if (lab.refusedConnect(refused) === true) {
    test.check('ECONNREFUSED is retryable — the far end never accepted anything');
  } else {
    test.fail('a refused connect was not recognised');
  }

  // Node wraps the cause; older shapes put the code on the error itself.
  if (lab.refusedConnect({ code: 'ECONNREFUSED' }) === true) {
    test.check('and it is recognised whether the code is on the error or on its cause');
  } else {
    test.fail('a bare ECONNREFUSED was missed');
  }
}

test.subHeading('Everything else might have arrived, so it is reported as it happened');

{
  // A RESET OR A HANG-UP IS THE DANGEROUS CASE. The connection was
  // established, so the request may have been read and acted on; sending
  // it again could create a second node.
  const risky = ['ECONNRESET', 'UND_ERR_SOCKET', 'EPIPE', 'ETIMEDOUT', 'ENOTFOUND'];
  const wrong = risky.filter(function (code) {
    return lab.refusedConnect({ cause: { code: code } }) === true;
  });

  if (wrong.length === 0) {
    test.check('a reset, a hang-up or a timeout is NOT retried — the request may have been read');
  } else {
    test.fail('these would be sent twice: ' + wrong.join(', ') +
      ' — POST /api/nodes creates a node, so this is not a style question');
  }

  if (lab.refusedConnect(null) === false && lab.refusedConnect({}) === false) {
    test.check('and an error that says nothing about why is not assumed to be safe');
  } else {
    test.fail('a shapeless error was treated as a refused connect');
  }
}

test.reportSuccessFailureCount();
