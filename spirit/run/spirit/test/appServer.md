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

### Bundles (goal/G41.12)

- **Every delivery is a bundle**: one JSON array of rows in one peerPost to the subscriber's streamListener.
- **Rows that back up go together**: while one delivery is in flight, the rows published behind it go in as few
  bundles as fit one answer, never one peerPost each.

### The position (goal/G41.12)

- **A subscribe again carries the position the client holds** (the sender's run id and the number of the last row
  it took).
- **The sender's bounded log answers it**: what came after that number, oldest first, with no bootstrap and no
  replacing of the cache. A row addressed to other keys (`to`) is left out.
- **A number older than the log, or a different run id, means a full push**. The log's size is the publisher's
  `logMax` option (the test uses 5).
- **A full push takes precedence and drops nothing** (goal/G41.15, Andy: "make sure the deskClient doesn't loose
  cached info outside the current goal", Q1: "nothing drops from the cache, unless the api.js from the server says so"):
  a row it carries replaces the one kept; a kept row it leaves out stays; a row never delivered is not invented. The
  same holds for a sender of a new run, after a restart.
- **Its place moves to the push** (the box: "a goal pushed whole takes precedence, and the client's place in the stream
  moves to that push"): once it lands, a subscribe again carries the push's own end (`run`, `n`), and is answered from
  the log, with no second push.
- **A late answer is no drop** (goal/G41.22, Andy: "take the 3 seconds out, appServer.js calls peerPost in the most
  basic way"): a delivery and a subscribe are plain peerPosts, raced against no clock of appServer's own. A subscriber
  answering within the publisher's own wait (`waitMs`) stays subscribed; the rows that piled up meanwhile go in one
  bundle after it. Only an answer of no, or none within that wait, drops it.

### The cache (goal/G41.12)

- **Only a client caches, by one switch**: `serve(verbs, { stream: { cache: true } })`, or `{ cache: { limit } }`
  with a limit in bytes (4 MB per sender when not given). Without it no cache file is kept.
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

- **The client's query of its cache through the family api.js, and `includeServer`**, and **the client bundling its
  requests**: the box names no verb for them; the build names them, and the verify asserts them.

## What its test must try to break

- A family path written anywhere but `familyPath`, or a `<name>.family` folder left.
- A delivery that is not an array, or one peerPost per backed-up row.
- A subscribe again answered with a bootstrap, a cache swept by it, missed rows not handed, a row for another key
  handed, or a full push that leaves old rows.
- A cache file missing, misnamed, not read back, kept without the switch or for a sender with no family folder, or
  past its limit.
