# spirit/peer/client/script.js — its own test

What a client knows of the peer family (goal/G41.28; Andy: *"WSL, make sure you assert that every family in the api
tree HAS a clientCacheManager"*). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs as it does, in a window of its own beside the real
`spirit/client/script.js`, which it writes into; in node it is loaded by its api.js, the one script that requires it (goal/G47.1).

peer.post carries a packet and peer.acquire files a key, whose row the contact family's manager keeps.

- In node, requiring `spirit/peer/script.js` loads it, and it stands at `spirit.peer.client`.
- Run beside spirit.required.spirit.data it makes its family there; it has no reads yet.
- **It keeps nothing, and names no branch**: it adds no translator, and a job of every kind the node streams, and a
  rename, leave its family's cache empty.

## What its test must try to break

- The family made under another name, so requiring `spirit/peer/script.js` leaves nothing at `spirit.peer.client`.
- A translator or a branch added here that keeps rows another family keeps.
