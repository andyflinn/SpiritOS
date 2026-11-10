# The relay store takes no old roll, invite or owner column in

goal/G43.23, item 7: `spirit/relayStore.js`'s part. Its test is `./relayStore.js`: this tree's `relayStore.js` opened in-process on scratch roots under /tmp.

The box: *"old-data rescue still runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json, the cycle-3 relay.db owner column."*

## Requirements

- routingTable.json, invites.json: the relay store, opened on a root holding them, takes neither the member nor the invite in, and leaves both files as they were, neither renamed `.imported`.
- The cycle-3 relay.db owner column: the relay store, opening a relay.db whose `members` table has an `owner` column, leaves the column and its values as they were.
- Never vacuous: the store opens, a member put is read back, the planted relay.db has its owner column and its member is read, or it is red.

The other parts of item 7: `./shellMove-noRescue.md`, `./relayKeys.md`, `./trafficLog.md`.
