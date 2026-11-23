# spirit/event/data.js — its own test

What a client knows of the event family (goal/G41.28; Andy: *"WSL, make sure you assert that every family in the api
tree HAS a clientCacheManager"*). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs as it does, in a window of its own beside the real
`spirit/data.js`, which it writes into; in node it is loaded as every client loads it, by requiring its branch's api.js.

The family is the stream itself: what it carries is kept by the family each row belongs to, never here.

- In node, requiring its branch's api.js, `spirit.requireScript('spirit/event/api.js')`, puts it at `spirit.required.spirit.data.event.data`
  (the api.js is the one script that requires its data.js).
- Run beside spirit.required.spirit.data it makes its family there; it has no reads yet.
- **It keeps nothing, and names no branch**: it adds no translator, and a job of every kind the node streams, and a
  rename, leave its family's cache empty.

## What its test must try to break

- The family made under another name, so requiring `spirit/event/api.js` leaves nothing at `spirit.required.spirit.data.event.data`.
- A translator or a branch added here that keeps rows another family keeps.
