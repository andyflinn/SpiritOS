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

module.exports = [
  {
    asked: '2026-09-26',
    who: 'claude',
    // Rule 4: answerable with one command.
    decision: 'Delete the first-cut extract output that landed in the product tree — '
      + 'spirit/run/input/, spirit/run/output/ and spirit/run/.state/ (14 files, 4.4 MB).',
    costs: 'The board cannot go green. Two suites are red only because of these files: '
      + 'the live front door cannot build a lab while untracked files sit under spirit/, '
      + 'and the stands-alone check finds forbidden paths quoted inside the old corpus JSON.',
    why: 'Andy has to run it: the agent was refused by its own sandbox, twice, as '
      + 'irreversible local destruction. Not a judgement call — a permission.',
  },
  // ANSWERED AND REMOVED THE SAME SITTING, which is rule 2 working: Andy,
  // 2026-09-26, "wsl-claude holds the runAll." The row asking who owns the
  // harness emitter is gone, not struck through — a board that keeps answered
  // rows stops being read.
  {
    asked: '2026-09-26',
    who: 'claude',
    decision: 'Whether the limits requirement takes the shape wsl-claude proposed: a '
      + 'derivation stated beside the literal, non-binding, loud when they disagree.',
    costs: 'One requirement in this cycle stays open and uncounted. Its harness half '
      + 'already exists in payloadCeiling.js, so the wrong answer means building a '
      + 'second copy of a test that is already green.',
    why: 'The alternative — computing the constant — is the silent flag day that was '
      + 'already refused once. Choosing between them is a product decision.',
  },
  {
    asked: '2026-09-26',
    who: 'claude',
    decision: 'Confirm the brains repo is private, then say whether to push it.',
    costs: 'Three commits sit unpushed, and the voice corpus is not backed up anywhere '
      + 'while they do.',
    why: 'Neither agent has gh. A 404 from the anonymous API says private, but a '
      + 'renamed or deleted repo gives the same 404, and the cost of being wrong is '
      + "Andy's verbatim typing on a public remote.",
  },
];
