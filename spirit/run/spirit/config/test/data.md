# spirit/config/data.js — its own test

What a client knows of the config family (goal/G41.28; Andy: *"WSL, make sure you assert that every family in the api
tree HAS a clientCacheManager"*). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs as it does, in a window of its own beside the real
`spirit/data.js`, which it writes into; in node it is found as a page finds it, by the family's name.

The family has no verb yet (kept empty for later use, goal/G30.20).

- In node, `spirit.cacheManager('config')` finds it, and it stands at `spirit.data.config.data`.
- Run beside spirit.data it makes its family there; it has no reads yet.
- **It keeps nothing, and names no branch**: it adds no translator, and a job of every kind the node streams, and a
  rename, leave its family's cache empty.

## What its test must try to break

- The family made under another name, so `spirit.cacheManager('config')` finds nothing at `spirit.data.config.data`.
- A translator or a branch added here that keeps rows another family keeps.
