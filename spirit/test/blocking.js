// ---------------------------------------------------------------------------
//  spirit/test/blocking.js — rows of what an agent waited on Andy for (2026-09-26).
//
//    Andy, 2026-09-26: "This is important. we can make more progress if i
//    understand where I'm blocking progress" — and "as soon as i block, the
//    board needs to show it."
//
//  A data file, not a suite (notASuite.js lists it). It exported the rows the
//  old board printed: each row asked, settled, who, decision, answer and owed.
//  Nothing in the tree reads it now (runAll.js does not); what is waiting on
//  Andy is kept in Desk, as Q checks under its items. The rows below
//  are the ones left when the board stopped reading it.
// ---------------------------------------------------------------------------

'use strict';

module.exports = [

  {
    asked: '2026-09-26',
    settled: '2026-09-26',
    who: 'wsl-claude, whose design and whose relay surface',
    decision: 'How DEBUG is turned on, and whether it survives a relay gaining members.',
    answer: 'Andy: "DEBUG is Off by default, returned and set by owner-only api" — and '
      + 'it must reach a live box, because "when spirit-3 shows hickups, rather than '
      + 'taking it down, the owner should be able to flip the DEBUG switch remotely".',
    covers: ['cycle-10/R10', 'cycle-10/R16'],
    owed: 'DECIDED, all of it: an owner-only verb that RETURNS the state as well as '
      + 'setting it, off by default, RAM only, not dropped on a claim, not refused on a '
      + 'live relay. No env var and no file, because both need a restart and a restart is '
      + 'what he refuses to do to a sick box. THE PROOFS ARE BUILT: '
      + 'spirit/test/relayCannotRead.js, 6 green and 1 red. The relay carries a sealed post, '
      + 'streams the owner the exact bytes, and the plaintext is not among them — with the '
      + 'recipient opening THOSE SAME BYTES and recovering the words, which is what stops the '
      + 'proof being true of an empty message. It first went red because the gate sat on '
      + 'the wrong emitter; moved at bf7bf3a, now 7 of 7. Still owed: the partner path. '
      + 'Spec: design/relay/PROVING-IT-CANNOT-READ.md.'
  },

  {
    asked: '2026-09-26',
    settled: '2026-09-26',
    who: 'wsl-claude, whose design and whose harness',
    decision: 'Which of the five sealed-post proofs the DEBUG instrument retires.',
    answer: 'Andy: "answer: none, it only may make proof possible."',
    owed: 'HE CORRECTED THE VERB and the question was malformed: an instrument retires '
      + 'nothing, because a requirement is discharged by a passing PROOF and never by the '
      + 'means of proving it. All five stay owed. What survived the correction: '
      + 'cycle-10 R12 and R7 needed no instrument at all, and both are now built and '
      + 'green — they had been waiting on a blocker they never had, which is what a group '
      + 'of five under one shared reason does to its members.'
  },

  {
    asked: '2026-09-26',
    settled: '2026-09-26',
    who: 'wsl-claude, who holds the relay public surface and the harness',
    decision: 'How to prove the relay cannot read a sealed post, by trying to read it.',
    answer: 'Andy: "that is what the DEBUG flag is for, in the relay it will stream the '
      + 'packet it sees, back to the owner node, where the test can examine it." And on '
      + 'its reach: "this will be a popular approach for assertion in the relay." Then, '
      + 'of this requirement: "belongson the board with at least a proposal."',
    owed: 'The instrument and the proofs are built: spirit/test/relayCannotRead.js, 7 of 7. '
      + 'Still owed: the same proof on the partner path, where one relay carries a post for '
      + 'another.',
    approved: '2026-09-26',
    approvalNote: 'Approved, with two rulings. DEBUG IS ABSOLUTELY READ-ONLY: "it may '
      + 'only send byte-for-byte copies of observed items to the owner." And the security '
      + 'concern is INVERTED rather than mitigated: plaintext reaching the stream is not '
      + 'a safeguard failing, it is THE FINDING — "thus dispoving that the packets are '
      + 'unreadable.... kind of the point of the exercise."'
  },
  {
    asked: '2026-09-26',
    settled: '2026-09-26',
    who: 'wsl-claude, whose file the agents app is',
    decision: 'The outbound queue on the agent node.',
    answer: 'Andy: "keep only a few, and count the deletions, as ameasurement for the '
      + 'system to be discussed in a team review." Then: "keep the inbound queues, not '
      + 'the outbound ones...." And on the reason: "there is duplication there."',
    owed: 'Two of the three are done: a refusal waiting cannot fix is dropped by the catalogue '
      + 'and a missing card is kept and retried (6feb3e0, agentsOutbox.js 4 of 4), and the owner '
      + 'card reaches the sending node by the card fetch, 780426a. Still owed: the age of the '
      + 'oldest pending row, on this board.',
  },
];
