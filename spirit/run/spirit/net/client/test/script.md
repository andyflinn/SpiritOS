# spirit/net/client/script.js — its own test

What a client knows of the net family (goal/G41.28; Andy: *"WSL, make sure you assert that every family in the api
tree HAS a clientCacheManager"*). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs as it does, in a window of its own beside the real
`spirit/client/script.js`, which it writes into; in node it comes with its branch's interface, `spirit/net/script.js`, the one script that requires it.

net.fetch answers one fetch the node made for the caller, not a row anyone reads again.

- In node, requiring `spirit/net/script.js` brings it, and it stands at `spirit.net.client`.
- Run beside spirit.required.spirit.data it makes its family there; it has no reads yet.
- **It keeps nothing, and names no branch**: it adds no translator, and a job of every kind the node streams, and a
  rename, leave its family's cache empty.

## What its test must try to break

- The family made under another name, so requiring `spirit/net/script.js` leaves nothing at `spirit.net.client`.
- A translator or a branch added here that keeps rows another family keeps.
