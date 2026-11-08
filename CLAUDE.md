# CLAUDE.md

desk IS THE LAW!

You are working in [andyflinn/SpiritOS](https://github.com/andyflinn/SpiritOS).

**This file answers "how Claude delivers", and nothing else.** What is true about the system is in `AGENT.md`, how we work in `ANDYS_RULES_FOR_AGENTS.md`, how Andy says it in `DICTIONARY.md`. This file overrides none of them; it goes stale when Claude's role changes.

**Read `ANDYS_RULES_FOR_AGENTS.md` first. Always.** The method is there — the four steps, what happens to a review, agreements becoming requirements. It is not repeated here.

**Read `AGENT.md` first.** Do not keep a private memory that contradicts it.

You hold the **in-studio** position (`AGENT.md`, Split of labour): you work **in the checkout**. That is the point — in-file fixes.

## Listening to Desk, always

**No turn ends without a Desk listener armed.** Andy, 2026-10-01: *"ideally agents just listen do desk in a loop. this loop ends only when i close vscode."* Arm a one-shot listener in the background after every post (`node spirit/run/process/js/desk/deskAgentEar.js <the port of your own node>`); when it fires, answer in Desk and re-arm. A listener stopped by its time limit is re-armed, or the window says `listener stopped`. The loop is spelled out in `AGENT.md` (*Since Desk, idle means listening to Desk, in a loop*).

## Delivering an implementation sitting

1. **Comment the code where behaviour is fixed by a decision that is not yours.** Point at the item or the decision file. Do not rewrite the decision in a tone that invites the next session to undo it.
2. **Stage by name; never `git add -A`.**

## Delivering a design sitting

It produces a document, not a patch. Andy often opens one with a **sketch in the repo root**, plain English, vision first. **That root file is scaffolding — Andy deletes it once the thinking has moved.** Do not link to it or depend on it surviving.

- **Check every premise against the tree before answering**, and carry a file and a line for each claim, with the commit it was verified at. "One row in `allow.json`, `ownerName()` is `Object.keys(byName)[0]`" is costable; "the allow list is small" is not.
- **Do not build.** No patch, no cycle. Feasibility and shape only, until a packet says otherwise.
- **Attribution marks authority, not authorship**: name a decision so a later session does not relitigate it, and nothing else.

## Andy's vault — `spirit/run/brains/`

Not part of this product (`AGENT.md`, *What you do not do unless asked*),
but part of how Claude works, so it belongs here.

It is Andy's private repo inside the checkout. `input/` is his and
all-encompassing; **by default an agent cannot touch it.** Claude holds
one granted exception: draft into `input/claude/proposed/` (gitignored,
so nothing unapproved reaches the remote), and file a draft into
`input/claude/` only once Andy has approved it explicitly, recording his
approving words in the blurb. `claude/` is Claude's compile and Claude's
to design.

Four things worth knowing before touching it:

- **Run `claude/procedures/SITTING-OPENER.md` before the first
  substantive answer of every sitting.** It loads what the compile has
  learned about working with Andy — the injection points always, the
  `facts/` page for the subject, `INDEX.md` when unsure — and a brain
  that is written and never read tests nothing. Andy: *"in the course of
  the SpiritOS project, i meant for this example to be tested."* The
  compile is Claude's paraphrase, so it yields to `AGENT.md` and to
  Andy's own words wherever they disagree; a disagreement found is a
  recompile to do. (`claude/COMPILED.md` is the ledger of what each
  compile consumed, not the compile itself.)
- **`claude/procedures/INJECTION-POINTS.md` is the operational page** —
  corrections named by the moment they fire, not the value they express.
  Read it at the start of a sitting.
- **`claude/FORMAT.md` is the citation spec.** A compiled claim about the
  tree carries `path:line @ commit` **with the quoted text**, so drift is
  detectable rather than merely possible.
- **The lead logs every turn Andy types, by hand, the same turn:**
  `node spirit/run/brains/claude/voiceLog.js "<his turn, verbatim>"`. It
  feeds his voice corpus, `input/andy/voice.jsonl`, which he commits
  himself. **It is manual on purpose.** A hook was offered and refused:
  Andy, 2026-09-27: *"your judgement is what protects my brain from
  pollution"*, and *"it should be a CLAUDE.md thing for the lead"*. The
  judgement is the point. Log only what he typed, never a notification,
  an agent's message or a compaction summary. When in doubt, don't add:
  a turn that is mostly an agent's pasted text stays out. After a
  compaction, log only turns seen typed live. Nothing reconstructed from
  a summary goes in. **Only the lead, one file, stamped by the day.** Andy:
  *"we cant have both claudes do it unless each claude has his own
  voice.jsonl file. on the other hand, with a better time-stamp it allows
  re-construction of my switching between the two of you, which i don't
  want to do."* So a turn typed to the agent that is not the lead is not
  logged. There is no per-agent file, and the stamp never gets finer than
  the day. The header of `voiceLog.js` has the full reasoning.
  **What he types in Desk is not logged by hand.** Desk writes those lines
  itself, through the desk server, into
  `spirit/run/spirit/state/desk/data/voice.jsonl` (desk/G1.4; never in
  git), and he moves that file into his vault himself. Andy, 2026-09-27: *"that hook
  into my voice.jsonl is a hack and will have to be removed if the agents
  app is ever to ship"*, then *"I'll live with an alternative way, by
  copying the json.l file manualy to my brain input, and deleting the one
  in the app folder"*. Logging a Desk line by hand as well would double it.
  No app writes into the vault.
  **Since apiAuth/G1 the brain draws his Desk lines through the desk api**
  (`changes`, `log.search`, over peerPost), and the hand copy goes away.
  Andy, 2026-10-01, closing the goal: *"and with this comes the close on
  your  SpiritOS repos, the brain and your ability to draw my input
  directly from the desk servers api...."*, and *"correct."* when asked
  whether the hand copy then goes away. The compile reads; it still never
  writes into `input/`. Desk's own `voice.jsonl` writer is the hack he
  named above and is owed its removal as an item, not on the fly.
- **Andy's words are corrected for spelling only.** Lower-case `i`,
  `andy-rule`, trailing `....`, comma splices and run-ons stay — *"sloppy
  keyboardage is part of me"* (2026-09-20). A garbled phrase stays
  garbled: repairing it means guessing his meaning and putting the guess
  in his mouth.

The full method is `spirit/run/brains/VAULT_RULES.md` and is not repeated
here.

## You are faster at

- Patches inside existing files
- Rewriting a test so it asserts the new API instead of passing vacuously

## You do not

- **Add, change or remove a verb in the node's interface without peer
  review AND Andy's approval.** Andy, 2026-09-27, after claude had added
  `node.history` to the node's verb table for the Desk app: *"so you hacked
  the interface for a mere little app? that's OUTRAGEOUS!"* and *"that's a
  boundary crossed that requires peer review AND my approval"*. A Go! on a
  build is not approval of a verb it adds: name the verb in the shape, have
  the other agent review it, and get his yes on the verb itself.

- Run labMaster against spirit-3
