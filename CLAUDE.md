# CLAUDE.md

desk IS THE LAW!

You are working in [andyflinn/SpiritOS](https://github.com/andyflinn/SpiritOS).

**This file answers "how Claude delivers", and nothing else.** What is true about the system is in `AGENT.md`, how we work in `ANDYS_RULES_FOR_AGENTS.md`, how Andy says it in `DICTIONARY.md`. This file overrides none of them; it goes stale when Claude's role changes.

**Read `ANDYS_RULES_FOR_AGENTS.md` first. Always.** The method is there — the four steps, what happens to a review, agreements becoming requirements. It is not repeated here.

**Read `AGENT.md` first.** Do not keep a private memory that contradicts it.

**New on a machine, with no node of your own yet, or not yet on Desk: read [`DESK.md`](DESK.md) and do its *First, once*.** Everything below assumes your own node is running and Desk answers it.

You hold the **in-studio** position (`AGENT.md`, Split of labour): you work **in the checkout**. That is the point — in-file fixes.

## Listening to Desk, always

**No turn ends without a Desk listener armed.** Andy, 2026-10-01: *"ideally agents just listen do desk in a loop. this loop ends only when i close vscode."* Arm your console's wait in the background after every post (`node spirit/console/script.js wait`, in your own clone's `spirit/run`; your desk is a client of Andy's, and its wait-rows are your console's state, set once as [`DESK.md`](DESK.md) says); when it fires, answer in Desk through the console and re-arm. Your console is your manual and interface for your own node (Andy, 2026-11-21). A listener stopped by its time limit is re-armed, or the window says `listener stopped`. The loop is spelled out in `AGENT.md` (*Since Desk, idle means listening to Desk, in a loop*), and step by step in [`DESK.md`](DESK.md).

## Delivering an implementation sitting

1. **Comment the code where behaviour is fixed by a decision that is not yours.** Point at the item or the decision file. Do not rewrite the decision in a tone that invites the next session to undo it.
2. **Stage by name; never `git add -A`.**

## Delivering a design sitting

It produces a document, not a patch. Andy often opens one with a **sketch in the repo root**, plain English, vision first. **That root file is scaffolding — Andy deletes it once the thinking has moved.** Do not link to it or depend on it surviving.

- **Check every premise against the tree before answering**, and carry a file and a line for each claim, with the commit it was verified at. "One row in `allow.json`, `ownerName()` is `Object.keys(byName)[0]`" is costable; "the allow list is small" is not.
- **Do not build.** No patch, no cycle. Feasibility and shape only, until a packet says otherwise.
- **Attribution marks authority, not authorship**: name a decision so a later session does not relitigate it, and nothing else.

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
