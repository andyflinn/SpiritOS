# shellMove

The move of `relay-state`'s own files to `spirit/state/` (goal/G43.8). Its test is `./shellMove.js`. Each case boots a real node or a real relay on a scratch copy of the tracked files, laid out as an old node left it.

Andy, box: *"remove proxy.json (no longer needed) and we move just the remaining files to spirit/state/"*, and *"flag day."*

## Requirements

- Every file and folder at the top of `relay-state` moves, by what is there and not by a list: files no list names, garbage, a database with its journal, a folder, a client's cache folder. Only `process/` and `shell/` stay, and what is in them stays.
- A node is who it was: `node.card` answers the same public key.
- *"No second private key stays on disc."* One file holds a private key after the move, `spirit/state/identity.json`.
- A key that does not read back stops the node, non-zero. The old file stays and no new key is made.
- A private key that does not give its public key stops it the same way, and no key reaches `spirit/state/`.
- A name `spirit/state/` already holds stops it, file or key. Neither the one standing there nor the old one is written over.
- `spirit/state/` is mode 700 and `identity.json` 600, on POSIX.
- The move runs before `server.js` requires `spirit.js`. `spirit/state/environment.json` names this boot's port, and a new process requiring `spirit.js` finds the node.
- A second boot moves nothing and keeps who it is.
- A relay of the old layout does the same: its key, its owner, its other files, one private key on disc.
- No code, script or test builds an old path, `appServer.js`'s `cacheDir` included. Comments are not judged.

## A process's files (goal/G43.10)

Andy: *"JUST state data."*, *"we will only move process relay-state data if the corresponding run://process/<name> still exists."*, *"whatever leftovers there are of now-eliminated process, we disregard"*. The box: *"A process's files in relay-state/process/<name>/ go to spirit/state/<name>/data/"*, *"skipping door.sock, the sidecars (Q6: "yes.") and bundles.json (Q13: "yes.")"*, and *"stopping if that fails"*.

- A process's files move, folders in them too, running or not. None stays behind.
- `door.sock`, its sidecar and `bundles.json` stay where they are, and none reaches `data/`.
- A folder with no `process/js/<name>/` stays where it lies and gets no new home.
- A running process keeps its database in its `data/`, none in the old place, and its door in the old place.
- No process's code builds a path into `relay-state`. Backup is the exception, as *"it will be ported later"*.
- Backup runs in a home of the test's own, and no private key reaches it. One private key stays on disc.
- A second boot moves nothing, and `bundles.json` is unchanged, so no second bundle.
- A name `data/` already holds stops the node, non-zero. Neither file is written over.

## Not judged

The box's *"tried on a copy of a relay's files"* is this test's relay case, on files laid out by hand, not a copy taken from a live relay. The rehearsals before and around the tag `v-2026-11-05-10-55` were run by hand on scratch relays at the previous tag, and are not part of this test.
