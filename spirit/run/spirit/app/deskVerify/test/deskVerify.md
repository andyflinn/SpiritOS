# spirit/app/deskVerify/deskVerify.js

The verifier's server (goal/G8.1, goal/G33.3). Its test is `./deskVerify.js`. It starts the file as the node does,
`node deskVerify.js <values> --pipe <pipe> --state <folder>` (spirit/jobs.js, runServer), from a scratch folder.
It never touches a real verify.db.

## Where it keeps its records

Andy, goal/G43.27: "cw, it's supposed to be in run:/spirit/state/deskVerify/data/ !!!!!!!!!!!!!!!!!".

1. **verify.db lives in its state**: started with `--state <folder>` and no `db`, it makes `<folder>/verify.db`
   and no file anywhere else.
2. **The node hands it spirit/state/deskVerify/data/**: the folder `jobs.js` names for an app is
   `spirit/state/<name>/data`, so on a node, verify.db is `spirit/state/deskVerify/data/verify.db`.
3. **`db` names another file**: given `db`, it keeps its records there and makes nothing in its state.
4. **With neither, it stops**: no `--state` and no `db`, it exits 2, says why and makes no verify.db.
5. **Its manifest leaves `db` empty**: `deskVerify.json`'s `db` default is `''`, so a node's start keeps verify.db in its state.

## What its test must try to break

- A verify.db made beside the script, in the old `process/js/deskVerify/`, or in the working folder.
- A `db` argument that is ignored, or a state folder written to as well.
- A start with neither that guesses a place.
- A manifest default that points `db` somewhere.

## Not tested here yet

The rest of the module has no test yet: run, now, stop, search, record, the idle chores and the pull. This file
covers where the records go.
