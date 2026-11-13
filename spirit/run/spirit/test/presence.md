# spirit/presence.js — its own test

`createRegistry(opts)` and `sayGoingAway(sinks, backInMs)`: who is connected to this relay, right now, in RAM. The
connection is the presence; a sink is anything with `write` and `close`. Owed since the rule *"every production script
has its own test"* (goal/G47.1, box v72). Each test plants recording sinks and a clock.

- `connect` / `disconnect` / `isPresent` / `present`: a connect is presence, a disconnect absence. No id or sink is
  403. Newest wins: a second connect replaces and closes the first, a sink throwing on close does not break it, a late
  teardown of the old sink does not evict the new one. `disconnect` is idempotent.
- The rate: six connects a minute per id (`DEFAULT_PER_MIN`), the seventh 429; per id, open again a minute later.
- The allowance, a refusal never a drop: a full relay answers a newcomer 503 `full` and closes nobody; a reconnect
  needs no room; `always` (the owner) is admitted whatever the count; streams held outside the book (`others`) count
  (goal/G30.12). `setAllowed` sets it, anything not a number from zero is unlimited.
- `evictIdlest`: longest-idle first (Andy: *"shedding longest-idle connections"*), by the later of last activity and
  open, sparing whom `spare` names; answers the ids closed.
- `send`: one SSE event, data JSON; false for an absent id. `broadcast`: to everybody or those `keep` keeps, dropping a
  sink that will not take a write.
- `sayGoingAway`: a `retry:` hint to each sink, then a close of each (the FIN behind the hint), counting those told;
  bounded 0 to an hour. `goingAway` tells every member and empties the book; `reset` closes all and forgets the rate.

## What its test must try to break

A reconnect measured against the allowance (a member locked out by its own corpse); a late teardown evicting the new
connection; a dead sink kept present forever (the relay lying); a full relay dropping someone already here; the hint
written after the close, or unbounded.
