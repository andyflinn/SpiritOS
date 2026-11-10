# spirit/nodeStore.js

The node's own database, `spirit/state/node.db`. This test holds one part of it (goal/G41.30): no rescue of old stores
is left in it.

## Requirements

- **No rescue operations** (Andy, 2026-11-02: *"let's get rid of those \"rescue operations\""*). The one-time move of
  goal/G40.11, which read the old seen rows, the relays list, apiAuth's peer names and `spirit/state/contacts.json` into
  the seen table on a node's first start and then deleted them, is gone:
  - its code names no `contacts.json`, has no `moveIn`, and reads no old `relays` or `peers` table;
  - a store opened on a folder that still holds an old `contacts.json` leaves that file as it is, byte for byte, and
    takes nothing of it into its table.

## What its test must try to break

- The move left in, whole or in part.
- An old book deleted, changed or read in.

## nodeStore.js marks no admitted

goal/G43.23, item 6 (after goal/G43.17). Its test is a section of `./nodeStore.js`, moved here from `spirit/test/nodeStore-noAdmitHold.js` (goal/G43.28): beside the file whose code it reads, its comments left out.

Andy, G43.17: *"Didn't i say remove ALL code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO."* The box: *"admit/hold left (G43.17): the traffic log's admitted mark (peerPost, trafficLog, arrivals, nodeStore), heldActions in the contact row, chatClerver's held / contact.accept code, the preferences migration in client/shell.js."*

### Requirements

- The code of `spirit/nodeStore.js` names no admitted mark.
- The traffic table the node's own store makes in `node.db` (opened on a scratch folder under /tmp) has no `admitted` column.
- The file is first shown read, its code still holding a line that is surely code, so a missing file or a stripper that ate the code is red, never a vacuous green.
