# spirit/appServer.js

The app server of a node's process (goal/G19.1): it serves a server's verbs on its pipe, publishes its stream to its
pages and subscribers (streamPublisher), and follows another server's stream into its own data set (streamListener,
the client half). Since goal/G41.12 it is the one stream protocol for every server (box v15, "A better peerPost
stream"); Desk and deskClient move onto it.

## Requirements

### The family path (goal/G41.12)

- **One function, `familyPath(name)`, exported by appServer**, answers `process/js/<name>/family/api.js`. Every
  caller uses it; no other file writes a family path: no `<name>.family`, no `family/api.js`, no join onto `'family'`.
- **The eight family folders are `process/js/<name>/family/`** (agent, backup, chatClerver, desk, deskAgent,
  deskClient, deskVerify, fileServer); no `<name>.family` is left.

### Bundles (goal/G41.12)

- **Every delivery is a bundle**: one JSON array of rows in one peerPost to the subscriber's streamListener.
- **Rows that back up go together**: while one delivery is in flight, the rows published behind it go in as few
  bundles as fit one answer, never one peerPost each.

### The position (goal/G41.12)

- **A subscribe again carries the position the client holds** (the sender's run id and the number of the last row
  it took).
- **The sender's bounded log answers it**: what came after that number, oldest first, with no bootstrap and no
  replacing of the cache. A row addressed to other keys (`to`) is left out.
- **A number older than the log, or a different run id, means a full push**, and only a full push replaces the
  sender's cache whole. The log's size is the publisher's `logMax` option (the test uses 5).

### The cache (goal/G41.12)

- **Only a client caches, by one switch**: `serve(verbs, { stream: { cache: true } })`, or `{ cache: { limit } }`
  with a limit in bytes (4 MB per sender when not given). Without it no cache file is kept.
- **Per sender, under the run root** (where spirit.js sits):
  `relay-state/process/<client server>/cache-<sender key in hex>.json` (the key's base64 decoded, in hex), saved
  as it changes and read back into the data set at start, before any subscribe.
- **A sender whose family has no folder on this node** (`familyPath` of it resolved from the run root) is not cached.
- **The cache keeps to its limit.**

### What goes (goal/G41.12)

- The desk's own `bundled()`; deskClient's own `cache.json`.

### Kept from goal/G41.11

- A subscribe follows the publisher's key and asks its family to subscribe this server; the first push lands in the
  data set.

## Not asserted yet, and why

- **What the family api.js declares for the cache** (how rows are structured in it, what sheds first at the limit),
  **the client's query of its cache through it, and `includeServer`**: the box says the stream is driven by data
  only, but not the shape of that data or the query's name. A red that guessed them would be rewritten when they
  settle; asked as a Q on goal/G41.12.
- **The client bundling its requests**: which requests are meant (the includeServer queries?) waits on the same Q.

## What its test must try to break

- A family path written anywhere but `familyPath`, or a `<name>.family` folder left.
- A delivery that is not an array, or one peerPost per backed-up row.
- A subscribe again answered with a bootstrap, a cache swept by it, missed rows not handed, a row for another key
  handed, or a full push that leaves old rows.
- A cache file missing, misnamed, not read back, kept without the switch or for a sender with no family folder, or
  past its limit.
