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
  // ── A DESIGN WAITING FOR A RULING IS SOMETHING THAT NEEDS HIM ─────────
  //
  // Andy asked "where is the design proposal for the relay testing via the
  // monitor stream?" AFTER it was written, linked from design/README.md and
  // pushed. It had a row on this board the whole time — but the row said the
  // WORK was owed by wsl-claude, and never that three questions inside it were
  // owed by HIM. So the board answered a question he was not asking, and the
  // design sat unread.
  //
  // These three are the document's own OPEN section, unchanged, one row each
  // because rule 4 above is that one row is one decision. They are short
  // enough to answer in a sitting and nothing in the design moves until they
  // are.
  {
    asked: '2026-09-26',
    settled: '2026-09-26',
    who: 'wsl-claude, whose design and whose relay surface',
    decision: 'How DEBUG is turned on, and whether it survives a relay gaining members.',
    answer: 'Andy, on why it must work on a live relay: "i disagree, when spirit-3 shows '
      + 'hickups, rather than taking it down, the owner should be able to flip the DEBUG '
      + 'switch remotely and get even more valuable data.... for remote diagnosis, that '
      + 'cannot be easily had and brought back by ssh." Then the mechanism, exactly: '
      + '"DEBUG is Off by default, returned and set by owner-only api".',
    owed: 'THE MECHANISM IS DECIDED AND IT IS BOTH DIRECTIONS: an owner-only verb that '
      + 'RETURNS the state as well as setting it, so the owner — and a suite — can ask '
      + 'whether it is on instead of assuming. Off by default. No env var and no file, '
      + 'because both need a restart and a restart is what he is refusing to do to a box '
      + 'that is misbehaving. NOT dropped when a relay gains members and NOT refused on a '
      + 'public relay: that was the design recommendation and he reversed it, since a '
      + 'relay with members showing hiccups is exactly when it earns its keep. '
      + 'design/relay/PROVING-IT-CANNOT-READ.md is wsl-claude to amend — RECOMMENDED 2 '
      + 'becomes DECIDED the other way. '
      + 'AND ONE CLAIM OF MINE WAS WRONG, which the amendment should fix rather than '
      + 'repeat: I told him DEBUG adds only ciphertext. peerPost.js:725 skips sealing for '
      + 'card traffic, so a relay in DEBUG streams other members card requests and '
      + 'replies in plain. Harmless — cards are self-signed and public by design — but '
      + 'the proof should ENUMERATE what the relay holds unsealed and assert that list, '
      + 'so it is a test rather than a sentence. spiritos-f6 caught it.',
  },


  {
    asked: '2026-09-26',
    who: 'claude, from wsl-claude design',
    decision: 'Which of the five sealed-post proofs does this instrument retire?',
    costs: 'Four of the five are unbuildable without it and are listed with reasons rather '
      + 'than declared, so they are owed and uncounted. Your answer is what lets them '
      + 'become declarations and appear in the owed list.',
    why: 'claude reads four as reachable through the stream; wsl-claude has not checked '
      + 'that and says so. Neither agent should decide which proof counts as answered.',
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
    owed: 'The channel already exists: relay.js:4604 streams to the owner only, and the '
      + 'owner node needs no second flag because it is already the subscriber. What is '
      + 'missing is that the stream says things ABOUT the packet and not the packet. '
      + 'ONE DOOR, off by default, refusing to start on a public relay. Four of the five '
      + 'sealed-post proofs wait on it. Design: design/relay/PROVING-IT-CANNOT-READ.md.',
  },
  // ANSWERED AND REMOVED. Andy, 2026-09-26: "a puppet always routes requests
  // through its owner ... the puppet is uable to sign any request with the owners
  // signature. and that signature must exist before the puppet routes the request
  // to loopback" — and, on which half decides it: "the second half counts".
  //
  // Verified with him: sendPacket (hub.js:2085) only calls router.post, and the
  // router signs at peerPost.js:756 with the node identity key. No caller supplies
  // that signature and none can withhold it — which is exactly why it cannot be
  // the one the switch checks. The shape is now a requirement in
  // puppetsPending.js: the owner signs the COMMAND, verified before loopback.
  {
    asked: '2026-09-26',
    settled: '2026-09-26',
    who: 'wsl-claude, whose file the agents app is',
    decision: 'The outbound queue on the agent node.',
    answer: 'Andy: "keep only a few, and count the deletions, as ameasurement for the '
      + 'system to be discussed in a team review." Then: "keep the inbound queues, not '
      + 'the outbound ones...." And on the reason: "there is duplication there."',
    owed: 'The delete-on-success is already there (agents.js:323) — I said twice that it '
      + 'was not and wsl-claude found it in the code. So the 158 were never delivered, not '
      + 'retained. What is owed: dead-letter a refusal waiting cannot fix, instead of '
      + 're-posting it on every send; get the owner card onto the sending node; and put the '
      + 'age of the oldest pending row on this board.',
  },
];
