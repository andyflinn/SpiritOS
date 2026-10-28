# spirit/appServer.js

The app server of a node's process (goal/G19.1): it serves a server's verbs on its pipe, publishes its stream to its
pages and subscribers (streamPublisher), and follows another server's stream into its own data set (streamListener,
the client half). Since goal/G41.12 it is the one stream protocol for every server (box v15, "A better peerPost
stream"); Desk and deskClient move onto it.

## Requirements

### The family path (goal/G41.12)

- **One function, `familyPath(name)`, exported by appServer**, answers `process/js/<name>/family/api.js`. Every
  caller uses it; no other file writes a family path: no `<name>.family`, no `family/api.js`, no join onto `'family'`.
  spirit.js holds the function, since the browser cannot load appServer, and appServer hands out the same one (cw,
  goal/G41.12 Q3); it is the one other file that writes the path.
- **The eight family folders are `process/js/<name>/family/`** (agent, backup, chatClerver, desk, deskAgent,
  deskClient, deskVerify, fileServer); no `<name>.family` is left.

### The roles (goal/G41.12, box v26)

- **`setMode("client" | "server")`, exported by spirit/appServer.js**, is called by the implementation at its startup:
  the desk `setMode("server")`, deskClient `setMode("client")`. A server that calls neither (Chatter) bundles nothing
  and keeps no cache.
- **No bundle verb**: a bundle is known by its shape, one JSON array of the existing calls.

### The server side (goal/G41.12, box v26)

- **Every request is answered "ok" at once, then handled** (the implementation's API is all PUT): a slow handler's
  caller has its "ok" before the handler ends.
- **A peer's bundle is answered "ok", never refused**; each request in it is checked against the node's grants table
  (spirit/nodeStore.js, `open(<run root>).auth.has(key, path)`, the table spirit/apiAuth.js reads; cw), granted when
  the key holds `<server>` or `<server>.<verb>`, and only a granted one is handed to the server, as a normal request.
  The test stands in for nodeStore and never opens the real node.db.

### The client side (goal/G41.12, box v27)

- **A client implementation asks through spirit/appServer.js**: `server.ask(key, family, verb, args, how)` (cw).
  In client mode (box v26, v28), while one ask is in flight, the ones behind it go together as one bundle: one
  `spirit.peerPost(key, 'api', { <family>: [calls] })` (cw), each call as it would go alone; five asks, two calls
  out, each ask answered. A child process of its own, in client mode.

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

- **Only a client caches**: `setMode("client")` turns the cache on, HARD-CODED at 4 MB per sender (box v26). Without
  it no cache file is kept. The test sends about 4.8 MB, past the limit whether a MB is 10^6 bytes or 2^20, and holds
  the file within 2^20 × 4.
- **Per sender, under the run root** (where spirit.js sits):
  `relay-state/process/<client server>/cache-<sender key in hex>.json` (the key's base64 decoded, in hex), saved
  as it changes and read back into the data set at start, before any subscribe.
- **It keeps every goal the sender sends**, no filtering on the client side, within its limit.
- **A sender whose family has no folder on this node** (`familyPath` of it resolved from the run root) is not cached.
- **The cache keeps to its limit, and the sender's family api.js on the client's node does the shedding**, declaring
  nothing (Andy, Q2: "it sits at the receiving end of the stream, it owns the cache, it knows the default cache limit,
  IT DOESN't HAVE ASK OR TELL ANYBODY HOW IT's JOB IS DONE"). For the desk: **the goal untouched longest goes whole**
  (Andy, Q2: "THE LONGEST UNTOUCHED GOAL GOES, LOCK, STOCK AND BARREL"); with one goal left, the item untouched
  longest goes whole, its chat with it; with one goal of one item, the oldest chat lines go (Andy, Q2: "when there is
  only one goal, then you shed the longest untouched item, LOCK, stock and barrel, when there is only one goal with one
  item you shed the oldest chat line").

### What goes (goal/G41.12)

- The desk's own `bundled()`; deskClient's own `cache.json`.

### Kept from goal/G41.11

- A subscribe follows the publisher's key and asks its family to subscribe this server; the first push lands in the
  data set.

## Not asserted yet, and why

- **The client's query of its cache through the family api.js**: the box names no call for it. `includeServer` is
  struck (box v24).

## What its test must try to break

- A family path written anywhere but `familyPath`, or a `<name>.family` folder left.
- A delivery that is not an array, or one peerPost per backed-up row.
- A subscribe again answered with a bootstrap, a cache swept by it, missed rows not handed, a row for another key
  handed, or a full push that leaves old rows.
- A cache file missing, misnamed, not read back, kept without the switch or for a sender with no family folder, or
  past its limit.
