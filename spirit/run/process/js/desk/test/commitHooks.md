# commitHooks: rules 3 and 4 at the commit

The hooks `process/js/desk/commitCheck.js` installs in an agent's own clone (goal/G3.9), driven end to end by real git
commits and pushes. Restored in goal/G43.23 from section E of `spirit/test/deskRules.js` (deleted in 885f1ab5; Andy's
box: bring back "deskClient's commit-hook checks"). A plain test of this folder: it covers commitCheck.js, git's hooks
and the agent's deskClient together. Its test is `./commitHooks.js`. The kept reads of goal/G41.11 are
`./commitCheck.js`'s.

## Requirements

- **Install** (`node commitCheck.js install <port>`, in the clone's root) exits 0 and writes the three hooks:
  commit-msg, post-commit, pre-push.
- **Refused, nothing committed** (Andy: *"You will not invent, design or implement code outside of the scope of the
  current goal."*, *"It is only through your use of the desk application that you will receive authorization to modify
  or create code"*): a commit whose message names no item, an item without his Go, an item of another goal than the
  current one, or a done item.
- **Taken** on an item of the current goal with his Go, not done.
- **Written at push, not at commit** (goal/G4.19, Andy: *"Push it is."*): one chat line under the item, `commit <hash>`
  as the remote holds it, and one `- path` line for each file the commit changed.
- **Re-stacked**: a commit a pull --rebase gave a new hash is written under the hash the remote holds, never the one it
  was made with.
- **A refused push writes nothing** (goal/G4.27, Andy: *"if that's what's needed. do it."*); pushed again, the line
  names the hash the remote holds.
- **Through the agent's own deskClient**: every ask is deskClient's desk verb on the agent's node, so it is counted.
- **The node unreachable refuses**: with no node answering, the commit is refused, not waved through.

## What its test must try to break

- A commit taken with no item, without his Go, of another goal, or on a done item.
- A line written before the push, for a push the server refused, or under the hash a commit was made with.
- A commit waved through when the node does not answer.

## How it is tested

The agent's deskClient is a fake loaded by a preload into every hook's node (NODE_OPTIONS): it answers the kept reads
from facts the test sets and logs each ask. The unreachable node is real: a scratch copy of `spirit/` and commitCheck.js
whose `spirit/state/environment.json` names a port nobody listens on, with no preload.
