# process/js/desk/commitCheck.js

The commit check (goal/G3.9): git hooks in an agent's own clone. A commit names an item of the current goal with
Andy's Go, not done; its staged files must be on that item's list, the list's core grant standing. This spec covers what
goal/G41.11 changes: a commit asks the desk nothing.

## Requirements (goal/G41.11)

- **A commit asks the desk nothing** (Andy: "the agents verifier has ALL the information needed for commits right on
  the agents node.... so we put in specific cache-searches into the deskClients api"). Every ask `check` makes goes to
  deskClient on the agent's own node as a kept read, cache only: `desk({ name, json, kept: true })`, `name` one of
  deskClient's kept reads (`KEPT_READS` in deskClient.js). deskClient answers it from its cache, or refuses it
  `not-kept` (saying why) without asking the desk. `items.search`, `item.files.search`, `item.checks.search`,
  `phase.may` and every other live ask are gone from the check.
- **What it reads, all from the kept facts:**
  - `item.get` gives the item's facts (goal, go, status, phase, red, phaseWith), and, beside them in the same answer,
    the current goal as `current` and the agent deskClient serves as `self`.
  - `item.files` gives the item's file list (`files`, each with its `path`; `filesMore` false when whole).
  - `item.checks` gives the item's checks, among them the list's `core grant: ` G check.
- **Missing from the cache, it refuses and says why**: a kept read refused `not-kept`, or a file list cut short,
  refuses the commit, naming what was not in the cache; it asks nothing else.
- **Every staged file must be on the item's list, core or not**, by its repository path; a file not on it is refused
  by name. A staged core file also needs the list's core grant standing.
- **A lagging desk refuses nothing it need not**: with the facts in the cache, a desk that does not answer does not
  stop the commit.
- **The red writer's build**: whether this agent may commit on the item comes from the kept facts (its red writer
  against `self`), not from the desk.

## What its test must try to break

- One live ask of the desk during a check, of any verb.
- A commit refused only because the desk lags, its facts all in the cache.
- A cache miss that falls through to the desk, or is waved through.
- A staged non-core file that is not on the list, let through.
