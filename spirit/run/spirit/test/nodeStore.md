# spirit/nodeStore.js

The node's own database, `relay-state/node.db`. This test holds one part of it (goal/G41.30): no rescue of old stores
is left in it.

## Requirements

- **No rescue operations** (Andy, 2026-11-02: *"let's get rid of those \"rescue operations\""*). The one-time move of
  goal/G40.11, which read the old seen rows, the relays list, apiAuth's peer names and `relay-state/contacts.json` into
  the seen table on a node's first start and then deleted them, is gone:
  - its code names no `contacts.json`, has no `moveIn`, and reads no old `relays` or `peers` table;
  - a store opened on a folder that still holds an old `contacts.json` leaves that file as it is, byte for byte, and
    takes nothing of it into its table.

## What its test must try to break

- The move left in, whole or in part.
- An old book deleted, changed or read in.
