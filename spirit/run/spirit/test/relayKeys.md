# spirit/relayKeys.js

What this node knows of the relays it has met. This test holds one part of it (goal/G41.30).

## Requirements

- **A report sets no star** (Andy: *"NO signature. just the armingButton, with a precise documentation of the risk."*;
  *"so this button will put the star on relays and puppets. AND take it away."*). `ownerSeat(rootDir, url, label)`, what a
  relay's report to its owner does here, notes the seat and leaves `mine` as it found it: it neither sets it nor clears
  it. A report is the relay's own word, and any relay can say it.

## What its test must try to break

- A relay made "mine" by saying so.
- A star taken away by a report.

## No relayKeys importOld on a booted node

goal/G43.23, item 7: `spirit/relayKeys.js`'s part. Its test is a section of `./relayKeys.js`: a real node (`spirit/server.js`) booted on a scratch copy of the tracked files of `spirit/run` under /tmp, the old relay files planted in it. Neither Andy's node nor an agent's is touched.

The box: *"old-data rescue still runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json, the cycle-3 relay.db owner column."*

### Requirements

- relayKeys importOld: a booted node takes no row and no route of a relay planted in `spirit/state/relays.json` and `relayKeys.json` into node.db, and leaves both files as they were.
- Never vacuous: the files are planted, the node comes up and opens its node.db, or it is red.

The other parts of item 7: `./shellMove-noRescue.md`, `./trafficLog.md`, `./relayStore.md`.
