// ---------------------------------------------------------------------------
//  spirit/test/blocking.js — WHAT AN AGENT IS WAITING ON ANDY FOR, RIGHT NOW.
//
//    Andy, 2026-09-26: "This is important. we can make more progress if i
//    understand where I'm blocking progress" — and "as soon as i block, the
//    board needs to show it."
//
//  ── WHY THIS FILE HAS TO EXIST, WHEN NOTHING ELSE ON THE BOARD DOES ───
//
//  The board's own rule is that blocked is a JOIN, NOT A FLAG (runAll.js,
//  `blockedNote`): a requirement's document says what it waits on, and
//  nothing an agent had to remember to set. That rule is right and it is
//  kept everywhere it can be.
//
//  It cannot be kept here. A BLOCK IS AN EVENT. It happens mid-sitting, at
//  the moment an agent stops and cannot go on, and there is nothing in the
//  tree that has changed for a join to notice. Documents are written at
//  sitting boundaries — hours or days later — so by the time a document
//  could say "blocked on Andy", the sitting is over and the waiting is
//  already spent. That is exactly the attention this page exists to save.
//
//  So it is a declaration, the same shape as `test.awaiting(...)`: an agent
//  writes it, the board reads it, and the cost of forgetting is visible
//  rather than silent.
//
//  ── THE RULES, SO IT CANNOT ROT ───────────────────────────────────────
//
//  1. AN AGENT THAT STOPS ON ANDY ADDS A ROW BEFORE IT ANSWERS HIM. Not at
//     the end of the sitting, not in the close — at the moment of asking.
//     A question put to him in chat and not written here is a block the
//     board cannot show, which is the whole failure being fixed.
//
//  2. THE AGENT THAT ASKED REMOVES THE ROW, in the same commit as the work
//     the answer unblocked. Nobody else removes it; nobody removes it
//     because it looks old.
//
//  3. `asked` IS THE DATE HE WAS ASKED, not the date of the sitting. The
//     board prints the age from it, so a row nobody cleared reads as "asked
//     4 days ago" — loud, and cheaper than a flag that lies quietly.
//
//  4. ONE ROW IS ONE DECISION. "Look at the brains repo" is not a row;
//     "which window holds the pen" is. If it cannot be answered yes/no or
//     with a name, it is not ready to be asked.
//
//  5. `costs` NAMES WHAT IS WAITING, in English, because that is the thing
//     he is deciding about. "the board cannot go green" is a cost;
//     "gap R13" is not — and even a correctly cited id is not one,
//     because a citation tells him where to look rather than what it
//     costs him. (Cited properly here on purpose: cycleCitations reads
//     this line as code and a bare number would go red, which is the
//     prose-matched-as-code trap this suite family has now paid for
//     three times.)
//
//  The rows below are real and open as of 2026-09-26.
// ---------------------------------------------------------------------------

'use strict';

// ── AND A THIRD STATE: RULED, NOT BUILT ──────────────────────────────
//
//   Andy, 2026-09-26: "ok, it needs an hourglass" — of a decision he had
//   answered whose code nobody had written yet.
//
// A row here used to have two states: on the board, or gone. So the moment
// he ruled, the item vanished — and the WORK his ruling implied vanished
// with it. That is the same dishonesty the owed list exists to prevent,
// arriving through the one section that was meant to be about his
// attention.
//
// So a row may carry `settled`: his answer, quoted, and what is still owed
// because of it. It stops being something that needs him and becomes
// something that needs us, and it keeps its place on the page under an
// hourglass rather than disappearing. It leaves when the work lands.
//
// A settled row names `owed` and `who`. If nobody can be named, it is not
// settled — it is abandoned, and it should say so.

module.exports = [
  {
    asked: '2026-09-26',
    settled: '2026-09-26',
    who: 'wsl-claude, whose file the agents app is',
    decision: 'The outbound queue on the agent node.',
    answer: 'Andy: "keep only a few, and count the deletions, as ameasurement for the '
      + 'system to be discussed in a team review." Then: "keep the inbound queues, not '
      + 'the outbound ones...." And on the reason: "there is duplication there."',
    owed: 'ANDY HAS GIVEN THE SHAPE, 2026-09-26: "the agent app is special, a post is '
      + 'implicitely coupled with a delete in the sent-log." IT IS ALREADY THE CODE '
      + 'SHAPE — agents.js:323 keeps only non-200 rows and rewrites the file, so a '
      + 'delivered post does remove itself. I said twice that it never deletes and both '
      + 'times I was wrong; wsl-claude caught it in the code. THE 158 WERE THEREFORE '
      + 'NEVER DELIVERED, not delivered-and-retained: every one was refused no-seal-key '
      + 'because the sending node holds no card for the owner. So the sent-log is not a '
      + 'duplicate of trafficLog after all — the log says what was ATTEMPTED, for good, '
      + 'and the sent-log says what is STILL OWED and empties itself. What is owed: '
      + '(1) A REFUSAL THAT WAITING CANNOT FIX MUST BE DEAD-LETTERED rather than '
      + 're-posted on every send. no-seal-key is a fact about the destination, not a '
      + 'transient, and retrying it turned 158 rows into 11,628 refusals. '
      + '(2) The sending node needs the owner card, which is the open 1a/1b choice. '
      + '(3) Optional, and Andy liked the direction: the age of the oldest pending row '
      + 'on the board, so a stuck channel is visible at a glance instead of after three '
      + 'days.',
  },
];
