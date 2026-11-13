# spirit/boxes.js — its own test

The owner's view of his boxes (public-app-server/G10, the node's half): each of his app servers reports four facts
about the box it sits on, and the node matches and sums; he decides (Andy: *"over-committed is a \"warning\" state
only."*). In memory by design, and believed only from a key in `spirit/state/servers.json`. Owed since the rule
*"every production script has its own test"* (goal/G47.1, box v72). On a scratch folder, arrivals handed in with the
envelope already read, as arrivals.js does.

- `SERVERS` is `servers.json`.
- `onArrival` + `list`: one row per fingerprint, its servers each with its allotment and report time; the allotments
  summed against the box's total; `warning` when the sum is over, never when equal. A server's `warning: false` hides
  nothing (facts, never an opinion). A server's newest report replaces its last.
- Only his servers: a report from a key not in `servers.json` is not kept at all (added to the list afterwards, its old
  report does not appear); no `servers.json` or a broken one means nobody. An app's packet, a packet with no box, no
  sender, null: not box reports.
- His list is read when he looks: a server taken off `servers.json` leaves the view and the sum at once.
- In memory: a new view starts empty, and nothing is written beside `servers.json`.
- `search` (puppets/G2, goal/G29.22): no words or `*` is every box, keyed by fingerprint; the label carries
  `— over-committed` when it is; searching `over-committed` ranks that box first though it reported last.
- `get(fingerprint)`: that row; unknown is null.

## What its test must try to break

Equal counted as over; a report believed from any key, or a stranger's kept until his list names it; a server taken
off the list still counted; allotments not summed; an app packet read as a box report; the warning word missing from
the label, so searching for it finds nothing.
