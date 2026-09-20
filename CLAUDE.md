# CLAUDE.md

You are working in [andyflinn/SpiritOS](https://github.com/andyflinn/SpiritOS).

**This file answers "how Claude delivers", and nothing else.** What is true about the system is in `AGENT.md`, how we work in `ANDYS_RULES_FOR_AGENTS.md`, how Andy says it in `DICTIONARY.md`. This file overrides none of them; it goes stale when Claude's role changes.

**Read `ANDYS_RULES_FOR_AGENTS.md` first. Always.** The method is there — the four steps, what happens to a review, agreements becoming requirements. It is not repeated here.

**Read `AGENT.md` first.** Do not keep a private memory that contradicts it.

You hold the **in-studio** position (`AGENT.md`, Split of labour): you work **in the checkout**. That is the point — in-file fixes, the test harness, regression. New bones arrive as full files from outside, and you receive them after Andy commits.

## Delivering an implementation sitting

1. **Findings first**, on the code that just landed or the diff Andy points at, triaged as the rules say.
2. **Apply fixes only after Andy answers.** A short pasted verdict is the leash for the sitting. Do not expand the sitting. On **design**, suggestions are welcome and often used — implement them only when the verdict says so.
3. **Comment the code where behaviour is fixed by a decision that is not yours** (ONE-OPERATOR, keys-mode stays open until invites, chat-to-relay census is owner-only, pending-owner, whoBook never uploads). Point at `AGENT.md` or the decision file. Do not rewrite the decision in a tone that invites the next session to undo it.
4. **Run the harness. Paste the last lines. Green means stop.** Stage by name; never `git add -A`.

## Delivering a design sitting

It produces a document, not a patch. Andy often opens one with a **sketch in the repo root**, plain English, vision first. **That root file is scaffolding — Andy deletes it once the thinking has moved.** Do not link to it or depend on it surviving.

- **Check every premise against the tree before answering**, and carry a file and a line for each claim, with the commit it was verified at. "One row in `allow.json`, `ownerName()` is `Object.keys(byName)[0]`" is costable; "the allow list is small" is not.
- **Do not build.** No patch, no test, no cycle. Feasibility and shape only, until a packet says otherwise.
- **The durable result lands under `design/`** — `design/<area>/<NAME>.md`, linked from `design/README.md`. Brief, no transcript of the back-and-forth: vision, feasibility, proposed shape, **decided / recommended / open kept apart**, so a third party can act without re-deriving it.
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

Three things worth knowing before touching it:

- **`claude/working-together/INJECTION-POINTS.md` is the operational
  page** — corrections named by the moment they fire, not the value they
  express. Read it at the start of a sitting.
- **`claude/FORMAT.md` is the citation spec.** A compiled claim about the
  tree carries `path:line @ commit` **with the quoted text**, so drift is
  detectable rather than merely possible.
- **Andy's words are corrected for spelling only.** Lower-case `i`,
  `andy-rule`, trailing `....`, comma splices and run-ons stay — *"sloppy
  keyboardage is part of me"* (2026-09-20). A garbled phrase stays
  garbled: repairing it means guessing his meaning and putting the guess
  in his mouth.

The full method is `spirit/run/brains/VAULT_RULES.md` and is not repeated
here.

## You are faster at

- Patches inside existing files
- `relayGates.js` / firstOwner / identityPerception / hostHardening and friends
- Restoring a gate that a bones commit ate
- Rewriting a test so it asserts the new API instead of passing vacuously

## You do not

- Open invites, Relay Chat chrome, or Caddy `X-Forwarded-For` in the same commit as a review fix
- Re-propose `User=spirit` or `/opt`
- Run labMaster against spirit-3
- Treat 0003’s “later names need the owner” as a bug in current keys-mode
- Reach into the bones to finish a UI tweak. Layout, copy, marks and CSS stay in the app and off the wire — that is in-file work. The moment a tweak needs `relay.js` gates, invite consume, the whoBook schema, a hub URL switch, relay identity or a new persist shape, **stop and call a team review (Andy + the reviewer)**. Do not patch `relay.js` so a dropdown works.
  (Cycle 3 opened one new persist shape by Andy's decision: `relay-state/relay.db`, owned by `relayStore.js`. That opening belonged to that cycle; the rule stands for the next one.)
