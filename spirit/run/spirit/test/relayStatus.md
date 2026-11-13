# spirit/relayStatus.js — its own test

What a relay tells its owner about itself, streamed to the owner node instead of a console (Andy). Owed since the rule
*"every production script has its own test"* (goal/G47.1, box v72). A pure function from facts to a report; every
fact, the clock too, is planted.

- `liveInvites`: unused, unexpired, labelled rows only, by the clock given; no array is none.
- `report`: owner, mode, key, version; `peers` (count or array) beside `present`; `routes`; invites as label, expiry
  and inviter, never the token; memory (rss, heapUsed, heapTotal) and whole-second uptime from the process figures
  handed in; the bounds, `binding`, `seats`, `capacity`, `meter`, `caps` passed through whole; `at` the capture time
  passed in; what was not reported absent, not zeroed; nothing handed in gives zeros and empties, no throw.

## What its test must try to break

A token leaking into the report a screenshot can find; a missing figure drawn as zero; a report that reads the machine's
clock instead of the one handed in.
