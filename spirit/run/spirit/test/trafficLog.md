# spirit/trafficLog.js

The node's traffic log. Its one test is `./trafficLog.js`, a section each below.

## trafficLog.js marks no admitted

goal/G43.23, item 6 (after goal/G43.17). Its test is the first section of `./trafficLog.js`, moved here from `spirit/test/nodeStore-noAdmitHold.js` (goal/G43.28): beside the file whose code it reads, its comments left out.

Andy, G43.17: *"Didn't i say remove ALL code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO."* The box: *"admit/hold left (G43.17): the traffic log's admitted mark (peerPost, trafficLog, arrivals, nodeStore), heldActions in the contact row, chatClerver's held / contact.accept code, the preferences migration in client/shell.js."*

### Requirements

- The code of `spirit/trafficLog.js` names no admitted mark.
- The file is first shown read, its code still holding a line that is surely code, so a missing file or a stripper that ate the code is red, never a vacuous green.

## The traffic log reads no old traffic.json

goal/G43.23, item 7: `spirit/trafficLog.js`'s part. Its test is the second section of `./trafficLog.js`: this tree's `trafficLog.js` opened in-process on a scratch root under /tmp.

The box: *"old-data rescue still runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json, the cycle-3 relay.db owner column."*

### Requirements

- The old traffic.json: the traffic log does not read a planted `spirit/state/traffic.json`, before node.db is written and after.
- Never vacuous: a row noted on the scratch log is read back, or it is red.

The other parts of item 7: `./shellMove-noRescue.md`, `./relayKeys.md`, `./relayStore.md`.
