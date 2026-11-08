# No relayKeys importOld on a booted node

goal/G43.23, item 7: `spirit/relayKeys.js`'s part. Its test is `./relayKeys-noRescue.js`: a real node (`spirit/server.js`) booted on a scratch copy of the tracked files of `spirit/run` under /tmp, the old relay files planted in it. Neither Andy's node nor an agent's is touched.

The box: *"old-data rescue still runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json, the cycle-3 relay.db owner column."*

## Requirements

- relayKeys importOld: a booted node takes no row and no route of a relay planted in `spirit/state/relays.json` and `relayKeys.json` into node.db, and leaves both files as they were.
- Never vacuous: the files are planted, the node comes up and opens its node.db, or it is red.

The other parts of item 7: `./shellMove-noRescue.md`, `./trafficLog-noRescue.md`, `./relayStore-noRescue.md`.
