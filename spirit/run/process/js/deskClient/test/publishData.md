# process/js/deskClient/publishData.js

One measurement run per agent, its data in `agents/<agent>/` (goal/G4.33; Andy: "so one single script for all of you
puts the data into the repo", "automated publishing will have a standing grant, attached to the script in
deskClient"). Run by the agent in its own clone, with its own node up.

    node publishData.js <port> [--asks N] [--only packets] [--out <dir>]

## Requirements

- Without a positive whole port it exits 2 with its usage. Outside a git clone (from the working folder): exit 1, `not
  in a git clone`. An agent with no name at the desk (`profile.get {agent: ''}`, through deskClient.desk on the spirit
  object): exit 1. A clone with no `spirit/run/relay-state/node.db`: exit 1, naming where it looked.
- The output folder is `--out`, else `<clone>/agents/<agent>/`; the commit is the short HEAD of the tree the script
  runs from.
- **1, unless --only packets**: the harness runs in a temporary git worktree of HEAD (the clone's relays.json carried
  over), `spirit/test/measurePlatform.js --agent <agent>`; how it exited is said; its files come back into the output
  folder; the worktree is removed and pruned.
- **2, the packet figures**: N read-only desk asks (profile.get, `--asks`, 20 by default), then the closing rows since
  just before them, from a read-only copy of node.db (the node holds it open): replies in, and requests out refused or
  unanswered. `packets.json` {agent, commit, measuredAt, asks, posts, waitMs {median, max}, flight {median, max} (ms
  less wait), retried (attempts > 1), refusals (by code, else outcome)} and `packets.md`. `platform.md` is written with
  --only packets, or when the harness left none.
- **3, the test state**: `testState.json` and `testState.md` from this checkout's deskVerify verify.db, the newest row
  of each test, read only; no suite run.
- The README and summary.json beside them (agentReadme.write).
- With `--only packets` or `--out` it stops there: exit 0, `written to <out>`, nothing committed, nothing posted.
- **4, otherwise**: zero posts is published too, and said; `agents/<agent>/` alone is committed (`git commit --only`,
  so what the agent had staged stays staged and uncommitted), message `publish: <agent> at <commit> (agents/<agent>/,
  the standing grant of goal/G4.33)`; pushed through pushOrigin; one line posted to Desk under goal/G0, `published
  <agent> at <commit>: wait m/M ms, flight m/M ms over P posts; agents/<agent>/`; exit 0.

## What its test must try to break

- A row counted that is not a closing row, or one from before the run.
- Medians, worsts, retries or refusals miscounted.
- A look (--out, --only packets) that commits or posts.
- A publish that commits his staged work, or anything outside agents/<agent>/.
- The node's own traffic log written, or a worktree left behind.

## Not tested

A harness that does measure (the scratch clone has no measurePlatform), a push refused, and pushOrigin's own
behaviour, which is its own module's.
