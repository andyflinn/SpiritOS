# spirit/relay/data.js — its own test

What a client knows of its node's relays (goal/G41.28): what `relay.get` answered, kept by `spirit.relay.status`
(`keep`). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs beside the real `spirit/data.js`; the test reads through `spirit.data.relay.data` alone.

- In node, `spirit.cacheManager('relay')` finds it.
- **It translates nothing**: the node publishes no relay.get answer.
- `keep(answer)` keeps one answer by its key, its relay and its report (none when it carried none); a refusal, or an
  answer with no key or no relay, keeps nothing; got again, it replaces what was kept.
- `relay(key)`, `report(key)` (null for no key), `watch(fn)` (the relay's key and what was kept; its release),
  `branch`.

## What its test must try to break

- A refusal kept; an old report left beside a newer answer; the key cut wrong where it holds slashes (a url).
