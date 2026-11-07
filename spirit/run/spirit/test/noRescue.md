# No old-data rescue runs

goal/G43.23, item 7. Its test is `./noRescue.js`: each old file planted in a scratch tree under /tmp; a real node (`spirit/server.js`) booted on a scratch copy of the tracked files of `spirit/run`, and this tree's `trafficLog.js` and `relayStore.js` opened in-process on scratch roots.

The box: *"old-data rescue still runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json, the cycle-3 relay.db owner column."*

## Requirements

- shellMove: a booted node leaves a file planted in `app/` where it lies, and writes nothing of it into `shell/`.
- shellMove: a booted node leaves a folder planted in `app-state/` where it lies, and writes nothing of it into `relay-state/process/` or `spirit/state/`.
- relayKeys importOld: a booted node takes no row and no route of a relay planted in `spirit/state/relays.json` and `relayKeys.json` into node.db, and leaves both files as they were.
- The old traffic.json: the traffic log does not read a planted `spirit/state/traffic.json`, before node.db is written and after.
- routingTable.json, invites.json: the relay store, opened on a root holding them, takes neither the member nor the invite in, and leaves both files as they were, neither renamed `.imported`.
- The cycle-3 relay.db owner column: the relay store, opening a relay.db whose `members` table has an `owner` column, leaves the column and its values as they were.
