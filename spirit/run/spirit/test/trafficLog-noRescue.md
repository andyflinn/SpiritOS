# The traffic log reads no old traffic.json

goal/G43.23, item 7: `spirit/trafficLog.js`'s part. Its test is `./trafficLog-noRescue.js`: this tree's `trafficLog.js` opened in-process on a scratch root under /tmp.

The box: *"old-data rescue still runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json, the cycle-3 relay.db owner column."*

## Requirements

- The old traffic.json: the traffic log does not read a planted `spirit/state/traffic.json`, before node.db is written and after.
- Never vacuous: a row noted on the scratch log is read back, or it is red.

The other parts of item 7: `./shellMove-noRescue.md`, `./relayKeys-noRescue.md`, `./relayStore-noRescue.md`.
