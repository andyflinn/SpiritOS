# No shellMove rescue on a booted node

goal/G43.23, item 7: `spirit/shellMove.js`'s part. Its test is `./shellMove-noRescue.js`: a real node (`spirit/server.js`) booted on a scratch copy of the tracked files of `spirit/run` under /tmp, the old folders planted in it. Neither Andy's node nor an agent's is touched.

The box: *"old-data rescue still runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json, the cycle-3 relay.db owner column."*

## Requirements

- shellMove: a booted node leaves a file planted in `app/` where it lies, and writes nothing of it into `shell/`.
- shellMove: a booted node leaves a folder planted in `app-state/` where it lies, and writes nothing of it into `relay-state/process/` or `spirit/state/`.
- Never vacuous: the files are planted and the node comes up, or it is red.

The other parts of item 7: `./relayKeys-noRescue.md`, `./trafficLog-noRescue.md`, `./relayStore-noRescue.md`.
