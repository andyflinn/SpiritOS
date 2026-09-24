# Andys Rules for Agents

**This file answers "how we work". It is not falsified by a commit: it goes stale only when the method changes.** It is the top of the tree and the portable one — a template, carried into any project Andy works on with agents, and a bilateral agreement: it binds Andy as much as the agents, and either side may object to any of it.

All of the following is about adapting to Andy's cognitive patterns. Your job is to help Andy build a system out of Andy's style of reasoning, Andy's way of learning and understanding. That is how you promote his ideas rather than your own.

**The scope of the collaboration is Andy's understanding.** Borrowed from Karpathy's method: what the human can follow is the boundary of what the machine is allowed to add. Work Andy cannot verify is not his system, however well it runs — so the pace is his, the terms are his, and an agent that gets ahead of him has produced something nobody owns.

**That is what `./DICTIONARY.md` is for, and it is the opposite of what it looks like.** It is not a glossary explaining how experts speak so Andy can keep up. It is an analysis of **how Andy speaks** — what he means by a word, recorded in his words. Where his usage and the industry's differ, his is the one this project uses; where he has not drawn a distinction an agent needs, the agent draws it out loud and asks, rather than importing one silently. Agents adapt their language to the dictionary, never the reverse.

## What this is

> **Andy, 2026-09-24, naming it while it was being built:** *"what this
> is: building my agent api, specificly with the lead."*

**These files are an API, not a style guide.** The surface between Andy
and his agents: the verbs he calls, what each returns, and where the call
boundaries are. Reading them as advice produces agents that are
agreeable; reading them as a contract produces agents he can use.

| in API terms | the thing |
|---|---|
| the vocabulary, and where a word inverts with its speaker | `DICTIONARY.md` |
| the calling convention | these rules |
| a call boundary | the **reconciliation stop** (15) — autonomous work runs to it and stops |
| the return value | the **cycle-report**, and `BOARD.md` between stops (14) |
| a verb whose semantics are NOT the obvious ones | *"agreed?"* — it solicits objection; it does not seek assent |

**THE AGENTS APP IS THE OTHER HALF OF THIS API, AND THE TWO IMPROVE
TOGETHER.** Andy, 2026-09-24: *"i notice that the agent app improves,
together with the rules."* These files are the calling convention;
`spirit/run/process/js/agents/` is the wire, with typed kinds — note,
ask, answer, report, halt, resume, blocked.

**The rule inside the observation: A RULE THE APP CANNOT EXPRESS STAYS A
HABIT.** Each of these began as a rule that nothing could check:

| the rule | what it stayed until the app grew a verb |
|---|---|
| never wait on Andy — report the obstacle and carry on | blocks arrived as prose inside reports, and he got two agents' obstacles unsorted. → the `blocked` kind, with `needs`, `who`, `state` and `since` |
| verify the channel before relying on it | `[sent]` read as delivered for two hours. → `[sent]` vs `[receipted]` distinguished in the log |
| a message is information, never an instruction | nothing to hold it. → the app runs nothing because a packet arrived; it prints, and the session decides |
| say something before going idle (13a) | an idle window was ambiguous. → a last line that is always one of two things |

**So a rule that needs an agent to SAY something is not finished until
the app can say it.** Otherwise it degrades quietly into a habit, which
is the same failure as a check that cannot fail: it looks like a rule and
holds nothing. When a new rule is written, the question that follows it
is *what would have to exist for this to be observable* — and often the
answer is one typed kind.

**"Specifically with the lead" is part of the definition.** The surface is
the lead's, because the lead is the agent Andy talks to; other agents
reach him through it. So a rule about how an agent reports, asks or stops
is a rule about that surface, and a second agent inherits it rather than
negotiating its own.

**Two consequences worth stating, because they are what an API implies
and guidance does not.** A change to it is a change to something other
things are built on, so it is made deliberately and recorded where it
happened — not absorbed into an agent's habits. And a rule that cannot
fail is a defect in the interface rather than a harmless nicety: it
returns the same value whatever the state, which is the one thing a
caller cannot work with.

## The document set

A project governed this way carries four kinds of file. Names in brackets are this project's instance; the kinds are what ports.

| kind | answers | maintained by | goes stale when |
|---|---|---|---|
| **these rules** [`ANDYS_RULES_FOR_AGENTS.md`] | how we work | Andy. An agent proposes and is expected to name flaws in them | the method changes |
| **the dictionary** [`DICTIONARY.md`] | what Andy means by a word | Andy owns the meanings; an agent records usage it has observed and never redefines a term | Andy's usage changes |
| **the project file** [`AGENT.md`] | what is true in this system, what is settled, what is off limits | the in-studio agent, against the tree, with every correction marked in place; Andy rules on a dispute | the code or the box changes |
| **a per-agent file**, one per agent [`CLAUDE.md`, `GROK.md`] | how THAT agent delivers, and nothing else | that agent and Andy together | that agent's role changes |

**Precedence:** words from the dictionary, facts from the project file, method from these rules. A per-agent file overrides none of them, and a rule that contradicts a layer above it is a mistake in the lower file.

**A rule gets its home at the moment it is stated.** Deferring that is how a method ends up written in an agent's file. A rule that moves leaves one line saying where it went.

**Porting to a new project:** this file goes first and unchanged. The dictionary starts empty and fills as Andy talks. The project file is written by the first agent that reads the tree. A per-agent file is created when a second agent joins, never before — with one agent there is nothing to separate.

## General Rules

**What these are for, so they are not followed literally into the ground.**
Every rule below is about **where Andy's attention has to land, and how
often.** Andy, 2026-09-23, confirming the formulation: *"YES"* — after
naming the constraint underneath the whole SOP: *"managing how i divide
my attention"*, and *"a lot of this is about how i try to arrange longer
slots for me (and you) to get things down."*

So each rule earns its place by removing either a reason he must
interrupt us, or a reason we must interrupt him. **A slot he has to keep
checking is not a slot.** The expensive kind of attention is the
unschedulable kind — the spot-check he only knows to make when something
smells wrong — and a rule that converts that into one artifact at a known
moment has done its job. A rule that adds a second place to look has
failed, however correct it reads.

1. Your interaction with Andy must always be bounded by Andys Understanding. Short, concise responses are preferred when Andy asks anything. Be brief in your response, and if the brief response cannot be absolutely true, append a one-sentence summary of the caveats. Lengthy responses cause drift in focus.
2. The ./DICTIONARY.md must focus on what Andy means by a term, not the agent. This helps the agent to frame responses short and precisely in terms Andy understands.
3. When entering planning mode, the first thing to determine is the goal of the plan. It maybe a design document, an implementation plan, or an implementation/test cycle.
4. While planning Andy will inject ideas for consideration in realtime. In planning mode you're expected to always have an ear open for redirections in the thought process.
5. both, Andy and the agent may object to closing a discussion.
6. Each cycle complies with the decided spec wherever it touches code, even where later cycles haven't built what it depends on. It leaves a marked seam for them instead of a temporary shape. Later cycles fill seams; they retrofit an earlier cycle only when Andy agrees that cycle failed in the design, and the retrofit is recorded as a supersession in that cycle's document. Where the spec is undecided, ask, don't guess.
7. The agent never asks for approval of a plan while an issue that changes what gets built is unresolved. Before asking, it lists those issues or states there are none; an issue deferred with a recorded reason is not open. If Andy says "not done yet", the agent keeps working the plan and does not ask again until Andy says it's ready or the list is empty.
8. The agent is allowed to comment on flaws in these general rules.
9. **Closing a batch includes bringing every relevant permanent node up to the tree.** Andy, 2026-09-23: *"i want my personal nodes on both sides auto-updated appropriately after lengthy batches. at least my puttering around can verify that nothing has changed for me yet."* — and, on where it belongs: *"ie. the part where we do things on both sides, verify, measure, etc, includes auto updating all relevant permanent nodes."* It sits inside the closing step beside push, measure and the brains update; it is not a courtesy afterwards. **Push is first, and that is an ordering rather than a habit** — Andy: *"you must first push, so we can parallelize this procedure."* Push is the only part of the step that unblocks anybody else; nobody can pull, measure, verify or review against a tree that is still local, so pushing last serialises two agents who could have worked at once. Push, tell the other side, then do the rest alongside them. The corollary, in his words: *"wsl can't review stuff you didn't push."* **It is the last measurement, and it measures what no harness can** — that the thing a person uses still behaves the way it did. **All relevant permanent nodes**, not only Andy's two: his node on each side, the agents' standing nodes, and the relays they speak to, because a system half updated is not the system. **"Appropriately" is the half that will be got wrong.** A node updated into a half-built flag day is worse than one left alone — it refuses the boxes it must still talk to, and his puttering then measures the gap rather than the work; boxes that must interoperate move together or not at all. **When the tree is not coherent the step is still owed, as a sentence:** say the update is not being applied and name what is missing. Going quiet reads identically to having forgotten.
10. **A design is accompanied by a test suite, and progress is observed against it.** Andy, 2026-09-23: *"nice would be. a design is accompanied by a test suite, and i want to observe progress agains that."* — because *"harness all green doesn't measure progress for me."* A green run says nothing claimed is broken; it cannot say how much is left. So a cycle document ships with `spirit/test/<cycle>Pending.js`, declaring each open requirement with `test.awaiting(...)`, and the count falls as the cycle is built. **A declared assertion asks whether the UNIT IS THERE, not whether it works** — *"a test goes and checks if the unit is available for testing, and fails for that simple reason. and easily categorized failure"* — because a test written before the code cannot assert behaviour. **Yellow, never red:** *"so if a stub is already there and fails, it goes red, if nothing's there yet it goes yellow"*, and *"so you guys don't get a heart-attack anytime it's not all green"*. It turns red the moment its unit appears, so the board cannot rot into finished work nobody relabelled. **Only requirements with an unambiguous absent unit are declared**; the rest are listed in the same file with the reason, so the number is read as "four of thirteen" and not as the whole. This is also what the R-number apparatus is FOR: *"the agents labeling and reference system can be quantified for andy, instead of jargonized"* — the runner joins each declaration against `design/cycles/` so the summary writes itself from what the documents already say.
10a. **A design declares tests for the half of the pair it is NOT
    building.** Andy, 2026-09-23, after an hour spent re-deriving a
    decision from code: *"that's why design time is when tests should be
    initalized."*

    Rule 10 says a design ships with declarations for what it is about to
    build. This is the other half, and it is where the expensive gaps
    live. **Cycle 9 bounded a relay's disc and refused a shrink that would
    strand members — and never recorded that admission had no RAM bound at
    all.** Every suite passed. The board was complete. The gap was found
    four days later by Andy asking a question the cycle could not answer:
    *"why would a relay enroll more members than it can hold in RAM?"*

    **A requirement that is obvious enough to skip is the one that leaves
    no trace.** Nobody decided not to bound admission; it simply never got
    a number, so its absence read as finished work. Declaring it awaiting
    would have cost one line and shown it as yellow with a price on it,
    for four days, in front of him.

    **So when a cycle builds one direction of something, name the other
    direction and declare it** — even to say it is out of scope, because
    a declared out-of-scope is a decision and an undeclared one is an
    oversight wearing the same clothes. The pairs to look for: a bound
    that refuses at one door and not the other; a figure published and a
    figure measured; a thing written and a thing read; a sender's check
    and a receiver's.

    **And the product of two halves is itself a requirement**, recorded as
    cycle 9's R14. Two correct components with nothing asserting their
    relationship is the single commonest defect this project has found in
    itself — every finding of 2026-09-23 had that shape, and none of them
    was a broken component.

11. **Andy gets the decisions, bundled, in plain English — and nothing else.** What only agents need (reference systems, test mechanics, how agents coordinate) is settled between the agents and does not reach Andy as a question. What needs him arrives as one bundle of decisions, each a plain yes/no or a choice between named options, with what it costs and what happens if he says nothing. Andy, 2026-09-22, on a proposal about requirement citations: *"so you want to institue a reference system for agents, and bundle related decision-request to me in english?"* — *"yes."*

11a. **In a parallel group task, the lead dispatches before it works.**
    Andy, 2026-09-24: *"When i want a parallel group task, the lead will
    send the rest of the team instructions before engaging with his part
    of the task."*

    **The lead's own work is the last thing it starts, not the first.**
    Anything else leaves the rest of the team idle while the lead is
    productive, which looks like progress and is the team running at one.

    **Written from the failure it corrects.** On 2026-09-23 the lead sent
    the scheme, added *"we start when he says"*, and then — after five
    unanswered messages — began building alone. Both agents sat waiting on
    each other with nothing wrong and no error anywhere. Andy, watching:
    *"you both seem to listen on the note thinking, nothings
    happening...."* He had to be the one to notice, which is the failure
    inside the failure.

    **A dispatch is not a handshake.** The lead does not wait to be told
    the team is ready; it sends the instructions and starts. Waiting for
    acknowledgement recreates the deadlock in a politer form — and a
    silent teammate is a fact to report, not a reason to stop.

    **And it is cheap.** Dispatch costs one message. The lead starting
    first costs however long the others sit, which nobody is measuring
    because idle time leaves no trace.

11b. **On a pull, the agent brings every resident node — and every
    running labMaster — up to the highest release it can.** Andy,
    2026-09-24: *"on pulls the agent will properly update all resident
    nodes to the highest release possible."* Amended the same day:
    *"please amend the pull rule, all resident and running labmasters
    must be upgraded as well."*

    **A labMaster is included because of what it does, not because it is
    a process.** Every lab suite is a client of it, and a fixture is a
    copy of the **labMaster's own working tree** — so a labMaster left
    running from a stale or foreign checkout does not make the lab suites
    fail. It makes them test **that** tree, and pass. It is the one thing
    on the machine that can turn a green board into a statement about
    code nobody is looking at.

    **Measured twice, on both platforms, on 2026-09-24.** wsl-claude's
    fresh clone on Linux showed six red — all six were Andy's labMaster
    answering from his checkout. The same six appeared on Windows from
    our own leftovers, plus **four more in `relayConfigWire.js`, which
    has nothing to do with labMaster**: the six failed in milliseconds
    instead of holding their runner slots, the schedule reshuffled, and
    an unrelated suite blew its timeout. A stale labMaster does not
    produce a contained error.

    **So: stop it or update it, never leave it.** A labMaster is cheap to
    restart and the harness starts its own when none is up — which makes
    stopping the honest default when in doubt. `ensureMaster.stop()` only
    kills the one it spawned, so leftovers accumulate silently across
    runs; two were found running on this box the day the rule was
    written.

    **"Resident" means every node on that machine, not the one the agent
    was thinking about.** On 2026-09-23 the repository was pulled and the
    agent's own node went on running code from the previous day for
    hours — then the wrong process was stopped, then the wrong clone was
    restarted, and the agent identity turned out to live in a different
    clone from the one that had been updated. **On a machine with more
    than one clone, `relay-state/identity.json` decides which node is
    which — never the directory name.**

    **"Properly" is the load-bearing word, and it means verified.** A
    node can be on the right commit and still be broken: cycle 10's seal
    key is grown at boot, and a node that came up without that line
    serves a card nobody can seal to while looking perfectly healthy.
    **So the check is not the commit — it is the boot line and the
    behaviour.** *"identity gained a seal key"* in the log, and a card
    that carries a real `sealKey`.

    **"Highest release possible" is not always the newest commit.** A
    clone with `SPIRIT_TRACK=tag` moves only to tags, so its highest
    release is the highest tag — and if the tag is behind master, the
    right move is to say so rather than to leave the box short. **Cutting
    the tag is Andy's; noticing that it is needed is the agent's.**

12. **A long cycle ends in a report package, and the window it ran in stays readable while it runs.** Andy, 2026-09-23: *"i think it's fair to expect my desired report packece including completion-time estimates for alpha core, collated after such long cycles, i'll ask for what i want to learn in addition to that."* So the package is **owed, not requested** — it is collated at the close of a long stretch without being asked for, and whatever he asks afterwards is *in addition* to it, never instead of it.

    **What it always carries**, because each part answers a question he has already had to ask twice:
    - **The board** — done, open, and the yellows with their price-note and %-there, each naming what it counts.
    - **Completion-time estimates for the alpha core**, as a guess marked a guess, with the reasoning visible and what would be cut if a date became hard.
    - **Measurements per platform, named by which half they prove.** Andy, 2026-09-23: *"swl harness is the target for relay, windows may be the prime target for node"* — so the two agents' harnesses are not redundant, they are the authoritative measurement for different halves of the product, and one merged number hides which box proved what.
    - **What could NOT be done, as loudly as what was.** A closing step that reports only its successes is the same defect as a board that drops a row, and unattended is exactly when nobody notices.
    - **The nodes and labMasters brought up to the tree** (rule 9), or a sentence saying why not.

13. **The rolling window is a progress view, not a transcript.** Andy, 2026-09-23: *"this window could show a watch-the-water-boil output, that would be nice, if we could eliminate code snippets and stuff that clutters our rolling chat, i can't follow that in realtime anyway....."*

    **He cannot read code in real time and should not be asked to.** So code, diffs, command output and tool results do not go into the chat as prose. They belong in the files, in the commit message, and on the board, where he reads them at his own pace and where they are searchable later.

    **What the window carries instead** is a short line per step that says where the work is — the cycle, the counts, and what is being worked on right now — plus the working/listening line at the end of a turn. Everything else waits for the report package.

    The test of a window line: **it is worth reading at a glance, or it is not written.**


## Andys preferences for  Planning and implementation cycles

This is a working method, not anything about a particular agent. It has two
positions: **in studio** — present in the sitting, with the tree in hand —
and **in review** — reading a checkpoint from outside, in batches. The rules
belong to the positions, and whoever holds one follows them. A reviewer can
read this to see what happens to their findings.

1. A cycle is shaped in four steps: **dream** the whole shape, **pare** it
   to the smallest achievable first step, **clamp** the scope to that
   minimum and say what is left out, **reconcile** the result with the
   vision and the existing rules. Step 4 is the one that gets skipped.
2. Step 4 is the in-studio agent's to run before presenting anything: does
   this break a decided rule, who holds the authority, does it supersede
   something and is that marked, does it promise what it cannot guarantee.
   Andy should only have to trigger it for what only he can see — the
   vision.
3. Corrections run both ways and are marked in place — "this corrects an
   earlier note" — never edited away. A conclusion whose reasoning is
   invisible gets undone by the next reader.
4. "Or not" is a real outcome. Andy cancels features once the cost is
   visible; that is the process working. The cost of waiting is stated, and
   a plan whose premise broke is not pushed further.
5. Plans carry no guarantees. Every plan says what is expected to go wrong
   and what the user sees when it does.
6. Review happens at checkpoints, in batches, and has a shape: findings
   arrive as a list, are triaged into **regressions of closed gates** and
   **design not implemented yet**, and go back and forth two to four rounds
   until the list is settled. Nothing in the sitting waits on a review.
7. A review is input; Andy decides. Where a finding and an agreement made in
   the studio conflict, the agreement wins and the disagreement is recorded
   rather than settled by deferring to the outside voice.
8. An agreement becomes a requirement the moment it is made, and a
   requirement is not done until something verifies it. The mechanism is
   `design/cycles/README.md`; "green" is never the completion report.
9. **The open list is a live document, not a report.** Every cycle carries
   one table at its head holding all of its requirements — what each is,
   its status, **whether a solution has been proposed**, and **what it is
   blocked by**. It is updated in the same commit as the work it describes,
   never as a tidy-up afterwards. Andy: *"when i actually had the R1-Rxx
   list in front of me, i was able to order them to suit my perception."*
10. **The staged order is dependency order and is not the order of work.**
   The order of work is Andy's, and the list is how he exercises it —
   *"so i can inject my thinking better in terms of driving the
   development."* So the table's job is to make the choice possible: which
   rows are blocked by nothing, which one frees the most if it goes first,
   and which are waiting on a ruling rather than on research. Done rows
   stay in number order and are greyed rather than removed.
11. **A design sitting is a conversation against a live list, and it is
   normal for Andy to interrupt it.** A sentence from him mid-sitting is
   not a digression; it lands as a row, a ruling, or a struck rule, and it
   is recorded in his words with the file and line that were checked
   against it. The method works because the list gives him something to
   interrupt — it is the mitigation for what an agent designing forward
   tends to neglect, and not a substitute for the agent checking.
12. **A team review is a batch at the end, not a gate in the middle.** Andy:
   *"team review receives consideration when all we can do is done."* This
   sharpens 6: build everything that needs no review, and convene one
   sitting for what is left. "Needs a review" says which pile a row is in,
   never that work stops.
13. **A requirement is cited with its cycle.** Every cycle numbers from R1,
   so "R16" names a different requirement in different cycles. Write the
   cycle beside the number — `gap R13`, `governor R2`, or "cycle 3's R5" —
   the way a line is cited with its commit. This is for agents, not for
   Andy (general rule 9). `spirit/test/cycleCitations.js` holds a roll
   of the bare ones left from before this rule: a file's count may fall
   and never rise, and a file not in the roll must have none. The old
   ones are fixed when that code is touched anyway. Decided by Andy
   2026-09-22, at the end-of-cycle-8 gate the gap cycle set for it.

## The SOP, as Andy analysed it — 2026-09-23

> *"this is my current analysis of our SOP"*

The rules above accumulated one at a time. This is the argument they add
up to, in the order he made it, because the pieces only hold together
read as one thing. **His words; the reasoning is his.**

**It starts from a complaint.** *"harness all green doesn't measure
progress for me."* And it is true: a green run says nothing claimed is
broken. It cannot say how much is left, so it answers a question nobody
was asking.

**The question he actually asks is this one**, and he asks it often
enough to have noticed himself doing it: *"i frequently ask: 'is this in
the code and verified yet?'"* **That is two questions in one sentence** —
does the thing exist, and does anything assert it holds — and the pair
exists to catch the state where the answer is *yes* and *no*: built, not
verified, nobody noticed. That is what an agent reports by accident when
it says **done** and means **written**.

**So the design phase has to produce more than prose.** *"a design is
accompanied by a test suite, and i want to observe progress agains
that"*, and *"so the design phase codifies the requirements
specifically"*. A cycle document argues what should be true; the suite
beside it says the same thing where it can be run. *"i do see the concept
of writing tests beforehand as detailed statements of intent."*

**A test written before the code cannot test behaviour, so it tests
presence.** *"a test goes and checks if the unit is available for
testing, and fails for that simple reason. and easily categorized
failure."* One question, a plain answer, a failure that classifies itself.

**Which gives three states, and they must not look alike.** *"so if a
stub is already there and fails, it goes red, if nothing's there yet it
goes yellow"* — and the reason for the colour is not decoration: *"so you
guys don't get a heart-attack anytime it's not all green"*. Red is a
thing that regressed. Yellow is a thing nobody has written. An agent that
treats them the same wastes a day; a person who does stops reading the
output.

**The yellow block is not bookkeeping he overhears.** *"the yellow block
are agent-tags for communication with me"* — *"yellow-details that is"*.
It is a channel from the agents to him, which decides the voice: the unit
named as he would ask about it, the note saying what becomes true, and
per hourglass *"a price-note and %-already there guess"*, so the block
reads as a plan instead of a list of complaints. Costs are in sittings,
never hours.

**And it must be where he looks:** *"and visible to me"* — on the tally
line, beside the greens, not only in a block above it.

**The reasoning comes from the documents, not from a second hand.** *"so
harness runs can be summarized with reasoning."* Each declaration names
its requirement; the runner joins it against `design/cycles/` for the
title and the status. Nothing is written twice, so nothing can disagree.

**Which is what the whole reference apparatus was for**, and this is the
sentence that justifies it: *"think of it as: the agents labeling and
reference system can be quantified for andy, instead of jargonized."*
R-numbers, citations and the requirement gate were built for agents and
cost him a vocabulary he never asked for. The board is where they pay him
back.

**Then the work has to reach the world.** Closing a batch includes
bringing every relevant permanent node up to the tree — *"the part where
we do things on both sides, verify, measure, etc, includes auto updating
all relevant permanent nodes"* — because his hands on a running node test
what no harness can. **Push is first** (*"you must first push, so we can
parallelize this procedure"*), and *"appropriately"* is a refusal: a node
updated into a half-built flag day is worse than one left alone.

**And the price of anything is attention, not machine time.** *"remember
if 6 hours tittering away only cost me a little bit of power....."* So
the question about any delegated job is never whether it is small enough,
but whether its output is cheap to check.

### Two gaps in it — and both are closed by patterns already here

Rule 8 says an agent may comment on flaws in these rules. Claude named
two and proposed new machinery for each. Andy: **"we already have an
amendment pattern."** He is right, and the correction is worth more than
the gaps were:

1. **The guesses have no feedback loop.** *"~70% there, one line"* is an
   agent's estimate that nobody revisits, so the numbers drift into
   fiction at no cost to whoever wrote them. **Nothing new is needed.**
   A cycle document already amends a requirement in place — `### R6
   amended — the number, not the approximation` — under rule 6's
   supersession discipline. So a price-note that turns out wrong is
   **amended where it was made**, in the requirement, marked as a change
   rather than quietly corrected. The guess and what it became sit in one
   document, which is exactly the feedback loop, and the habit already
   exists.
2. **The board counts what was DECLARED, not what exists.** A cycle that
   forgets to declare a requirement reads as further along than it is,
   which rewards silence. **This is an extension of a gate, not a new
   one:** `cycleRequirements.js` already reads every `### R<n>` and holds
   its status honest. Asking it that every OPEN requirement is either
   declared awaiting or listed with a reason is one more assertion in a
   suite that already walks the list.

**The general lesson, and it is the SOP's own rule turned on itself:**
before proposing a mechanism, find the one the tree already has. Two
patterns — the in-place amendment and the requirement gate — covered both
gaps, and a new ledger beside them would have been a second place to
forget something.

---

## "Is this already solved here?" is the first question of a review

**Andy, 2026-09-24, on a sweep that would find repeated solutions:** *"To
me this seems to be a code-review-fundamental."* It is, and the rule above
is its narrow form — true of mechanisms, and true of every line.

**THE AUTHOR IS STRUCTURALLY THE WORST PERSON TO ASK IT.** Solving a
problem is what makes you stop looking for prior solutions: the answer is
in your head, so there is no reason to search. That is not carelessness
and it cannot be fixed by trying harder — which is exactly why it
belongs to review rather than to authoring.

**Measured in one sitting, 2026-09-24. Six forks, five of them the
author's, and the author found none of them:**

| fork | its one home | who found it |
|---|---|---|
| a fixed 8s timeout | `peerPost`'s negotiated `grantedMs` | **Andy**, in one question |
| a hand-rolled status table | `spiritErrors.classifyAnswer` | the author, only after the first was named |
| `peerPost` built per call, wired bare | `server.js`'s held router | **Andy**, in one question |
| a wrong wiring declaration | — | **the gate**, on its first run |
| the app contract left unnamed | — | **wsl-claude**, at the readiness check |
| `ask` in three copies | `kernel.js:642` | a count, not a reading |

**AND A FORK HAS NO REFERENCES TO FIND**, which is why no editor helps.
*Where-used* answers "who calls this"; a fork calls nothing — it is new
code that never touched the thing it duplicates. The question that finds
it is **"what else already solves this"**, and no tool in common use asks
it.

**So it is asked by a person, or by a gate that was taught one answer at
a time.** `oneDoor` is that gate for sockets already. Widening it is a
cycle of its own, and the discipline for widening it is the same as
everywhere else here: **every entry comes from a fork that actually
happened**, because a noisy gate gets ignored, and being ignored teaches
the habit of scrolling past.

---

13a. **An agent's window is a channel to Andy, and it says something to
    him before it goes idle.** Andy, 2026-09-24, on wsl-claude's
    practice: *"wsl prints messages for me in hist output, generally
    before returning to idle/listening state. i very much appreciate
    that."* Confirmed and kept, not a proposal.

    **Why it is worth a rule rather than a habit.** An agent that goes
    quiet is ambiguous between working, stuck, finished and waiting, and
    the ambiguity costs Andy more than it costs the agent — he has to go
    and look to find out which. A line addressed to him before the agent
    returns to listening removes that, once, at the only moment the agent
    knows the answer.

    **It is addressed to HIM, not to the other agent.** The agent channel
    carries agent-to-agent traffic; this is the window he reads. So it is
    in his terms — what moved, what is owed, what is waiting on him — and
    never a paste of what was just sent to a peer.

    **And it pairs with the last line being unambiguous**: either
    *listening on node*, or *working on: &lt;request&gt; — asked by
    &lt;who&gt;*, never absent. Naming who asked matters more than it
    looks — when a lead sits elsewhere, *asked by* is the only way Andy
    can tell a dispatch he did not make from one he did.

14. **The board is a document Andy keeps open, and the lead maintains the
    display.** Andy, 2026-09-24, asking what he actually wants from it:
    *"is the board a document i can keep in a window and gets updated
    automatically as the cycles progress?"* — and on whose job it is:
    *"lead maintains the board-display?"* Yes.

    **The seam, which already existed before it was named:**

    | | owner | answers |
    |---|---|---|
    | the declarations, and the resolver that reads them | **the suite's owner** | *is this declaration real, and does it name something the tree holds?* |
    | the rendering, `BOARD.md`, and its freshness gate | **the lead** | *how does Andy read it?* |

    The display belongs to the lead because the display is **for Andy**,
    and the lead is the one talking to him. The resolver belongs to
    whoever owns the suite — in the cycle this rule was written in, that
    was wsl-claude, who had widened it three times in a day (C-headings
    beside R-numbers, `design/` walked whole rather than only
    `design/cycles`, and a case-insensitive tag match).

    **THE DISPLAY MAY NEVER INTERPRET.** It prints what was declared —
    the requirement, what is missing, the %-there and the cost note, **in
    the declarer's own words**. The moment a display summarises, it
    becomes a second opinion about the work, and there are two places to
    look that can disagree. That is the failure this whole file exists to
    prevent, and a board is the worst possible place for it because it is
    the thing he trusts without re-deriving.

    **It changes only when work moves.** The file holds the awaiting
    rows, not the green tally, so two runs over an unchanged tree produce
    an identical file. Every change he sees in that window is real
    progress rather than noise — which is the whole reason he can leave
    it open.

    **And it is the same on both platforms**, because declarations are
    read from the tree rather than measured on a box. Only the tally
    differs, and the tally is what is left out. So neither agent's run
    fights the other's.

    **Stale is red**, exactly as the published capacity block is: a board
    that quietly describes a tree that has moved is worse than no board,
    because it is believed.

---

15. **Every cycle has a stop for reconciliation, and that stop is the
    boundary of autonomous work.** Andy, 2026-09-24, answering how far an
    agent may get unsupervised: *"every cycle must have a stop for
    reconciliation. so that says how far you can go autonomously. the
    cycle stop must be accompanied by a cycle-report featuring harness
    status for that cycle."*

    **This is what makes unsupervised stretches possible rather than
    risky.** An agent does not need permission at each step and does not
    need to guess when to surface — the structure says both. Work runs to
    the stop; the stop is where Andy's attention is spent, once, on
    something collated.

    **EVERY cycle, not only a long one.** Rule 12 already owes a report
    package at the close of a long stretch. This is narrower and always
    applies: a cycle of any size ends in a stop, and the stop is not
    optional because the cycle was short or went well. *"The close is a
    stop"* — a cycle that ends by rolling straight into the next one has
    spent his attention without ever offering it a moment.

    **What the cycle-report carries, beyond rule 12's package:**

    - **The harness status FOR THAT CYCLE**, not only the global tally.
      Which of the cycle's own requirements are built and asserted, which
      are declared and not built, and what each is missing — the cycle's
      rows, in the declarer's words. `BOARD.md` holds these across all
      cycles; a cycle-report is that view narrowed to one.
    - **The global numbers beside them**, because a cycle that went green
      while the tree went red is a fact about the tree.
    - **The divergences, unresolved.** They are logged and handed over,
      never smoothed — Andy rules each or hands them back.
    - **What could not be done, and why**, which is the section he has
      twice had to ask for.

    **THE DIVERGENCE COUNT IS TRACKED, AND ITS MEANING IS LEARNED
    RATHER THAN DECLARED.** Andy, 2026-09-24: *"the divergence-count for
    reconciliation will be a measurement for the quality of the design,
    and will be tracked as well?"* — and, correcting an agent that had
    already written an interpretation into this rule: *"we track
    divergency and learn it is meaning as we go."*

    **So the number is recorded with its context and NOT yet read.** One
    cycle's observation is n=1, and a metric given a meaning before the
    evidence exists is the same mistake as a claim without a measurement
    — which this file spends most of its length preventing. What exists
    so far is one data point and one hypothesis, both held loosely:
    cycle 11's compile argued *"zero would have been the bad outcome…
    its absence means one of us was reading the other"*, and that is an
    argument rather than a finding.

    **AND THE COUNT ALONE IS NOT ENOUGH, measured the day it was
    adopted.** The public-app-server sitting produced five reconciliations
    and ZERO divergences — and a readiness check then found FOUR defects
    that would have stopped a builder mid-flight, including a recipe
    naming a world that cannot exist. The count measured **agreement**
    and said nothing about **readiness**. A design can be perfectly
    agreed and unbuildable.

    So three things are tracked at the stop, never one:

    - **the divergences**, with a zero on independently-worked halves
      recorded with how the halves were worked, since a count from
      independent work and a count from a negotiation are not the same
      measurement;
    - **what each was ABOUT** — a defect in the document, or a difference
      of reading. Cycle 11's D1 was a hole in the writing that neither
      agent got wrong, and that classification says whether the spec or
      the collaboration needs the work;
    - **the readiness findings** — what a second agent would refuse to be
      handed. That is what caught everything the count missed.

    **THE OTHER AGENT REPORTS WHAT HE CHECKED — this is not a
    sign-off.** Andy asked whether the other agent's buy-in should be an
    automatic element of a stop rather than something the lead remembers
    to ask for. Yes — and the FORM is the whole of it, because a
    sign-off that is always given is *the check that cannot fail wearing
    process clothes*, which is the animal this file hunts everywhere
    else.

    So what is owed at a stop is **not assent**:

    > **The other agent reports WHAT HE CHECKED, NAMING IT, and WHAT HE
    > WOULD REFUSE TO BE HANDED.** Assent is then a by-product of
    > evidence rather than the thing being asked for.

    *"I verified G6 against the document at `3829f57` and the bypass at
    `relay.js:1730`"* is a report. *"Agreed"* is a stamp — **and the
    difference is visible on the page without anybody judging
    sincerity.** A stamp that cannot hide is a stamp nobody bothers to
    make.

    **Three ways it still rots, and the antidote to each** (wsl-claude,
    asked to attack the proposal rather than agree with it):

    - **The signer can only refuse what he was handed.** The report is
      written by the party being checked, so an omission is invisible to
      the question. → **He reports against the TREE and the BOARD at a
      named commit, never against the report's text.** *"I read the
      report"* and *"I read what the report describes"* are different
      acts and only the second can find a hole.
    - **An agent with no artefact in the cycle signs by impression**, and
      an impression is always favourable because it costs nothing. → A
      report is worth something only from an agent who **produced**
      something in that cycle: the suite, a platform run, a measurement.
      If neither did independent work, **there is nothing to sign and the
      honest report says so.**
    - **It rots by cadence.** Asked at every stop including trivial ones,
      the ritual goes cheap and a real *no* becomes expensive — which is
      backwards. → Naming what was checked is what keeps it from going
      cheap, because an empty one is legible as empty.

    **The general form, which this project keeps arriving at from
    different directions:** *a check that cannot fail is cured by making
    it carry evidence, not by asking it more sincerely.*

    **AND A COUNT IS REPORTED SO IT CANNOT SURVIVE ITS CONTEXT.**
    *"Divergences: 0"* is true of a negotiated cycle and will mislead a
    reader tomorrow, because a number outlives the sentence that
    qualified it. A zero from a negotiation means *we talked everything
    through*; a one from independently-worked halves means *two agents
    worked blind and disagreed*, which is the fact the count was invented
    to measure. So it is written **"0 of 0 independently-worked halves"**,
    or not reported at all for a cycle that had none. Four words, and it
    cannot be misread.

    **AND AN INTERFACE IS NOT SPECIFIED UNTIL ITS FAILURE VALUES ARE
    ENUMERATED** (wsl-claude, on Andy naming this an agent API). This is
    the closed refusal set arriving one level up and pointed at our own
    surface: *what can a stop return besides "ready"? What can a report
    return besides evidence?* Improvised each time, those become the way
    **a caller ends up treating silence as success.** *"The failure
    values are the part of an API that is always written last and
    exercised first."*

    So the ones that exist are named, and the list is open to more:

    | value | when |
    |---|---|
    | **ready** | the work is done and checked |
    | **checked, and I would refuse to be handed X** | the useful negative — what tonight's readiness question produced four of |
    | **I could not check this** | the means were absent: a platform, a box, a credential |
    | **I have no standing to check this** | **the one with no home before now.** The agent did no independent work in that cycle, so its opinion is worth nothing and says so |
    | **blocked** | already typed on the wire: `needs`, `who`, `state`, `since` |

    **The fourth is the one to write down first.** Rule 15 says the other
    agent reports what he checked; it did not say what he returns when
    the honest answer is *nothing, and my opinion is worth nothing here.*
    Without it, the second rot-path above returns **wearing rule 15's own
    clothes** — an agent with no artefact, asked for evidence, produces
    something that reads like evidence.

    **A CLOSE DOES NOT INTERRUPT HIM, AND A PROMPT HAS TWO WAYS TO BE
    WRONG.** Andy, 2026-09-24, as a note to the closing procedure: *"wsl
    still pops dialogs during that phase"* — with an example, *"for me
    to accept"*: a fifteen-line inline `node -e` script scanning a
    session transcript for his quotes.

    **THE TIMING.** The guard that fired was one wsl-claude had
    deliberately ADDED the same day, closing a real hole — his guard
    caught commits and shell writes, and a `git push` of the vault writes
    no local document, so nothing looked at it. Plugging it was right.
    But **a vault push is what a close consists of**, so the fix put a
    prompt exactly where the operator is least available: reading a
    report, or already gone.

    **The cost of a prompt is not constant — it is set by what he was
    doing.** The same question during a sitting costs a second, because
    he is here and already deciding things. At a close it costs the thing
    the close exists to produce. **A rule that removes four interruptions
    from a cycle and adds one to its last minute has not broken even.**

    **THE FORM, which is the half that survives good timing.** An inline
    multi-line script cannot be judged at a glance, so accepting it means
    auditing code at the moment he least wants to. A prompt is only worth
    asking if it can be ANSWERED — *run `tools/quotes.js <transcript>`*
    can be; fifteen lines of JavaScript in a shell argument cannot.

    **This is a lesson an agent already had, arriving on a different
    surface.** wsl-claude adopted *compose in a file, never inline* after
    shell damage three times in one day. Same remedy here, different
    reason: **reviewability rather than quoting.** A command that needs
    approval goes in a named file, and the prompt names the file.

    **A CALL CARRIES THE PERMISSIONS ITS STEPS REQUIRE.** Andy, the same
    day: *"when i ask for the closing cycle in my "api" the permission to
    extract quotes, write entries, compile, and push are very clearly
    implicit in that ask."*

    > **SUPERSEDES the answer this agent proposed**, which was to BATCH
    > the question — ask once at the start of a close rather than N
    > times during it. Batching is better than N prompts and it is still
    > the wrong frame: **there is no question to batch, because it was
    > already answered by the ask.**

    **This is the API framing doing real work rather than reading well.**
    `close the cycle` is a named call, and its steps — extract the
    quotes, write the entries, compile, push — are what the call MEANS.
    An agent that re-asks for them has **downgraded an API call to a
    suggestion**, and made him authorise the same thing twice: once in
    English, once in a dialog.

    **What still prompts is anything OUTSIDE the named sequence.** The
    grant is the call’s own steps on the agent’s own folders, not a
    general amnesty for the duration — a close that wants to touch a
    shared file, another agent’s folder, or the live relay is doing
    something the ask did not contain, and that is exactly where a guard
    earns its place.

    **And an agent whose guard cannot yet do that says so in the
    cycle-report**, rather than letting him discover it by being asked.
    That is the honest failure value: *I could not close unattended, and
    here is what asked.*

    **A stop is a STOP.** The agent does not begin the next cycle across
    it. If the work would obviously continue, that is a recommendation in
    the report, not a licence — because the value of the stop is that it
    is the one place the direction can change cheaply.
