# spirit/seenPeers.js — its own test

Who this node has seen, and what they are called: the rules of what is learned and when a row goes, over nodeStore's
seen table. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). Each test opens a
store on a scratch home, the path the node takes, with a planted clock.

- `createSeenPeers`: throws with no store and no rootDir (a caller with no store gets no memory); a rootDir opens
  nodeStore there.
- `note`, `get`: no key is false and writes nothing; a peer noted is got back, `seen` the moment it was noted, or the
  moment the caller passes (goal/G2.9); a miss is null; one row per peer; no route, via or road on a row (goal/G47.1).
- Greedy, rank first (cycle R29): a label is not blanked by a note that has none, and `seen` still moves; a worse rank
  never overwrites a better label, the same or better does; no rank named is HEARSAY. HOST 1, PROVED 2, ARRIVED 3,
  HEARSAY 4.
- Presence three-valued: nothing said is null, and silence never marks somebody away. `relay: true` never goes back.
- `set`, `listed`, `forget`, `reset`: flags written, the row made; listed is kept and owned rows only (goal/G40.11);
  forget removes the row; reset empties.
- The space bound (0016, 0021): `MAX_BYTES` 20 MB, Andy's anchor; no age limit; over the bound plain rows go first,
  before ignored ones, never a kept one; a note sheds as well as `size`; `roomToAdd` refuses a new row when only kept
  rows are left and never refuses a kept one; yes with room.

## What its test must try to break

A label from a search wiped by a later arrival; a second-hand name overwriting the host's rename; a forgotten rank that
wins; a kept contact shed for space; an age limit forgetting while there is room; a route written back onto a row.
