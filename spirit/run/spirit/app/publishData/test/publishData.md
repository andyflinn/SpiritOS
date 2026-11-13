# publishData, an app of its own

goal/G43.21. Its test is `./publishData.js`: the tree read as it is, and the script run once with no argument from a folder that is no git clone, so it stops before it asks any node anything.

Andy: *"spirit/app/publishData/publishData will be fixed to point at the correct files/folders"*, and *"the Andy user on each box will run those scripts when he feels like it, that will take the running of those scripts out of the agents hands. much simpler."*

## Requirements

- Run with no argument, as Run starts it, it does not stop at its usage: the node port comes from the node that starts it (`SPIRIT_CALLBACK_URL`), and it goes on to its first step.
- It reads testicle's `testicle.db` where testicle keeps it, its state `spirit/state/testicle/data/` (Andy: *"publish Data
  uses testicle data."*), and no other test database.
- `agentReadme.js` stands beside it in `spirit/app/publishData/` and loads.
- No agent starts it: `spirit/app/deskClient/publishData.js` and `agentReadme.js` are gone, and `deskClient.js` names no publishData.

## The noSummary part: spirit/app/publishData/publishData.js

goal/G43.22. Its test is the noSummary part of `./publishData.js`: the tree read as it is, comments left out.

Andy, the box: *"the apps and plugin system goes."*, *"there will only be goals, items and rules left, plus the verifier stuff can stay for now."*

### Requirements

- Andy: *"publishData summary is no longer needed, i only check on github."*: publishData posts nothing to the desk.

## The run part: spirit/app/publishData/publishData.js, run whole

One measurement run per agent, its data in `platform/<platform>/` (`windows`, `wsl` or `ubuntu`, by the machine; goal/G47.1,
box v104-105: *"folders identifying the platform, NOT the agent"*, *"repo://platform/windows/, repo://platform/wsl/,
repo://platform/ubuntu/, depending on where publishData runs...."*; goal/G4.33; Andy: "so one single script for all of you
puts the data into the repo"). Run in a clone with its node up; since goal/G43.21 Andy starts it with Run in its app
detail (*"the Andy user on each box will run those scripts when he feels like it"*), and its commit takes the commit
check's standing grant for `platform/<platform>/`.

    node publishData.js <port> [--asks N] [--only packets] [--out <dir>]

### Requirements

- Without a positive whole port, given first or handed by the node that starts it (`SPIRIT_CALLBACK_URL`, goal/G43.21), it exits 2 with its usage. Outside a git clone (from the working folder): exit 1, `not
  in a git clone`. An agent with no name at the desk (`profile.get {agent: ''}`, through deskClient.desk on the spirit
  object): exit 1. A clone with no `spirit/run/spirit/state/node.db`: exit 1, naming where it looked.
- The output folder is `--out`, else `<clone>/platform/<platform>/`; the commit is the short HEAD of the tree the script
  runs from.
- **1, gone**: the harness step went with the old harness (Andy's commit "KILL!", e9c6cb8c, removed
  `spirit/test/measurePlatform.js`); nothing runs a harness and no worktree is made.
- **2, the packet figures**: N read-only desk asks (profile.get, `--asks`, 20 by default), then the closing rows since
  just before them, from a read-only copy of node.db (the node holds it open): replies in, and requests out refused or
  unanswered. `packets.json` {agent, commit, measuredAt, asks, posts, waitMs {median, max}, flight {median, max} (ms
  less wait), retried (attempts > 1), refusals (by code, else outcome)} and `packets.md`. `platform.md` is written every run.
- **3, the test state**: `testState.json` and `testState.md` from testicle's current tests, read only; no suite run. Its
  counts are testicle's current rows: every current test, the failed ones its reds, each named with its script and suite.
- The README and summary.json beside them (agentReadme.write).
- With `--only packets` or `--out` it stops there: exit 0, `written to <out>`, nothing committed, nothing posted.
- **4, otherwise**: zero posts is published too, and said; of `platform/<platform>/` only the files it wrote are committed, never a tool of his in that folder (`git commit --only`,
  so what the agent had staged stays staged and uncommitted), message `publish: <agent> at <commit> (platform/<platform>/,
  the standing grant of goal/G4.33)`; pushed through pushOrigin; nothing posted to Desk (goal/G43.22: Andy, *"publishData
  summary is no longer needed, i only check on github."*); exit 0.

### What its test must try to break

- A row counted that is not a closing row, or one from before the run.
- Medians, worsts, retries or refusals miscounted.
- A look (--out, --only packets) that commits or posts.
- A publish that commits his staged work, or anything outside platform/<platform>/, or a tool of his there.
- The node's own traffic log written.

### Not tested

A push refused, and pushOrigin's own
behaviour, which is its own module's.

## Box v104: the platform's folder, and always pushed

- It publishes to `platform/<platform>/` in the repository (box v105), the platform this machine is: `windows`, `wsl` (Linux under WSL) or `ubuntu`, never
  a folder named after the agent (Andy: *"make sure publisData simply writes to folders identifying the platform, NOT the
  agent"*); its commit message names that folder.
- Always and reliably pushed (Andy: *"make sure it works, commits and pushes always and reliably so."*): another clone
  pushes a commit of its own to the origin meanwhile; published again, it exits 0, and the origin holds its new commit on
  top of the other clone's.
