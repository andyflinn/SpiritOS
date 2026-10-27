# process/js/desk/goalShare.js

The desk shares currentGoal.json through git itself (goal/G4.21; Andy, 2026-10-04: "can the automatic handle the
complications?", "do it", "yes, that's the shape."). The rules file shares the same way under its own message
(goal/G5.8). desk.js starts it as a job of its own node.

    node goalShare.js --repo <dir> --path <path in the repo> --from <file> [--remote origin] [--branch master] [--message <text>]

## Requirements

- Without `--repo`, `--path` or `--from` it exits 1 with its usage; a `--from` that is not there exits 1,
  `goalShare: no file <from>`.
- One attempt: fetch `<remote>/<branch>`, build **one commit on its tip** that sets `<path>` to the bytes of `<from>`
  and changes nothing else, push it. Exit 0 printing the pushed hash.
- The same bytes already at the tip: no commit, exit 0 printing the tip's hash.
- **His checkout is never written, pulled or rebased**: the commit is built in a temporary index (`GIT_INDEX_FILE`)
  from objects only, so his files, his index, his HEAD and his branches stay as they were; he gets the file on his
  next pull.
- A refused push (someone pushed in between) is fetched, rebuilt on the new tip and tried again, at most 5 times
  (TRIES); then exit 1, `goalShare: gave up after 5 tries: <the last reason>`. A failing fetch is a try that failed.
- `--remote`, `--branch` and `--message` default to origin, master and `currentGoal.json, shared by the desk
  (goal/G4.21)`; a path written with backslashes is the repo's forward-slash path.
- Every way out removes the temporary index first (`process.exit` skips a `finally`).

## What its test must try to break

- A commit that touches anything but the path, or sits on a stale tip and drops somebody's push.
- His HEAD, branch, index, files or stash touched.
- A commit made when the bytes are the same.
- More than 5 tries, or a refusal that exits 0.
- A temporary index left in the temp folder.
