# spirit/app/goalShare/goalShare.js

goalShare is an app of its own, and shares the current goal and the rules in one commit, with no argument
(goal/G43.28, its box). Andy: *"move goalShare into spirit/app/goalShare/ like pushOrigin"*, *"it's an app with NO mount
at all, but a node:run:true"*, *"the goalShare file just will just push both, current goal and rules. AT THE SAME
FUCKING TIME"*, and *"one button that says "Share Current Goal", so from my point of view, it has no argument"*.

The script runs as a job runs it, its own process with nothing handed, from a copy of it placed inside scratch
repositories of the test's own (a bare origin with a pre-receive hook that refuses when told, his checkout with work of
its own, another clone that pushes in between). The job's id is asked of a scratch node. Nothing reaches a real remote.

## Requirements, one per box line

1. `spirit/app/goalShare/goalShare.js` and this test and spec are there; `spirit/app/desk/` holds no `goalShare.js`
   nor its test.
2. `goalShare.json`: an icon, label `Goal Share`, not intrinsic; no mount, no shell mount, no tile, no node mount;
   `node.run` true. On a node it is started without being switched on.
3. It reads no argument (no `--repo`, `--path`, `--from`, `--remote`, `--branch`, `--message`, no `process.argv`). Its
   commit is built in a temporary index (`GIT_INDEX_FILE`); his HEAD, index, files and unsaved edit stay as he left
   them; a refused push is rebuilt on the new tip and tried again, keeping the push made in between.
4. `nodeDesk.js` hands `jobs.create` `spirit/app/goalShare/goalShare.js` and nothing else, and no longer starts the
   `goalShare.js` beside it.
5. Its job's module is `spirit.app.goalShare`, never desk's.
6. With both files in desk's state, one commit sets `spirit/run/spirit/app/desk/currentGoal.json` and
   `spirit/run/spirit/app/desk/rules.md` to their bytes and changes nothing else, pushed once.
7. `spirit/app/test/api-deskMove.js` and `.md` are deleted.
8. No tracked file names `spirit/app/desk/goalShare.js`; `spirit/test/jobs.js` and `jobs.md` name `nodeDesk.js` and
   `spirit/app/goalShare/goalShare.js`, not `desk.js:2608`.
9. It commits into the checkout that holds it, found by its own place, and ignores the old arguments when handed
   them; desk starts no share with neither `goalRepo` nor `goalPath` set (`nodeDesk.js:49`).
10. With neither file in desk's state it says `nothing to share`, exits 0, and makes no commit; with only one, that
    one alone is shared.
11. Desk's state folder is as it was after a share: nothing written, changed or added.

## What its test must try to break

- An old argument still read; `require('path')` is not one.
- A second argument handed by desk; `path.join(...)` inside the one argument counts as one.
- Two commits, or two pushes, for the two files.
- A share that commits when there is nothing to share.
- A write into desk's state.
