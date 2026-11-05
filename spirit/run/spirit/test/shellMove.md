# shellMove

The move of `relay-state`'s own files to `spirit/state/` (goal/G43.8). Its test is `./shellMove.js`. Each case boots a real node or a real relay on a scratch copy of the tracked files, laid out as an old node left it.

Andy, box: *"remove proxy.json (no longer needed) and we move just the remaining files to spirit/state/"*, and *"flag day."*

## Requirements

- Every file and folder at the top of `relay-state` moves, by what is there and not by a list: files no list names, garbage, a database with its journal, `peerStats`, a client's cache folder. Only `process/` and `shell/` stay, and what is in them stays.
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

## Not judged

The box's *"tried on a copy of a relay's files"* is this test's relay case, on files laid out by hand, not a copy taken from a live relay. The rehearsals before and around the tag `v-2026-11-05-10-55` were run by hand on scratch relays at the previous tag, and are not part of this test.
