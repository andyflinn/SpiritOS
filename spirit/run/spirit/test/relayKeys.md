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
