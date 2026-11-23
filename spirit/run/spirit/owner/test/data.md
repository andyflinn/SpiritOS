# spirit/owner/data.js — its own test

What a client knows of the owner family (goal/G41.28; Andy: *"WSL, make sure you assert that every family in the api
tree HAS a clientCacheManager"*). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs as it does, in a window of its own beside the real
`spirit/data.js`, which it writes into; in node it comes with the family's `api.js`, the one script that requires it.

No client reads the owner's boxes or sends his commands from a page yet.

- In node, `spirit.requireScript('spirit/owner/api.js')` brings it, and it stands at `spirit.required.spirit.data.owner.data`.
- Run beside spirit.required.spirit.data it makes its family there; it has no reads yet.
- **It keeps nothing, and names no branch**: it adds no translator, and a job of every kind the node streams, and a
  rename, leave its family's cache empty.

## What its test must try to break

- The family made under another name, so `spirit.requireScript('spirit/owner/api.js')` leaves nothing at `spirit.required.spirit.data.owner.data`.
- A translator or a branch added here that keeps rows another family keeps.
