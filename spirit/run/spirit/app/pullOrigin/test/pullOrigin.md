# pullOrigin

goal/G47.1. Its test is `./pullOrigin.js`: each case its own clone with a bare origin and a second clone that pushes to it, in the temp folder; the clones keep line endings as written (`core.autocrlf` false, set at each `git clone`).

Andy: *"we also need pullOrigin, the counterPart of pushOrigin, both for dumb Users like me."*; *"pullOrigin needs to pull to the front of master, past any mess that sometimes blocks it..."*; Q27, whether it restarts the node: *"no sophisticated thing, just pull, past anyhing that blocks it, push any changes i made"*.

## Requirements

- Given no repo, or a folder that is no clone, it answers `{ ok: false, reason }` and throws nothing.
- Its owner's edited and new files are committed and pushed; the clone ends at the front of master (on master, at origin's master, nothing unsaved, nothing in progress).
- Behind origin, it takes origin's newest and lays its owner's change on top.
- With nothing of its own and nothing new on origin, it ends well and makes no commit.
- Where its owner and origin changed the same line, its owner's line wins, and it is pushed.
- A rebase left in progress is ended; a merge left in progress is ended; either way the clone ends at the front of master.
- A detached HEAD goes back to master, its own commit kept on a branch `pullOrigin-<time>`.
- A clash no side wins (origin deleted a file its owner changed) leaves master at origin's, its owner's commit kept on a branch `pullOrigin-<time>`, and its answer says so.
- Run with no argument, as Run starts it, from a folder that is no repo, it syncs the clone it lives in, and its line says ok.

## What would make it red

- A change of its owner's left uncommitted or unpushed, or the clone anywhere but the front of master after a run.
- Origin's line winning over its owner's on the same line.
- Anything in progress left in progress.
- A commit of its owner's lost: neither on master nor on a `pullOrigin-` branch.
