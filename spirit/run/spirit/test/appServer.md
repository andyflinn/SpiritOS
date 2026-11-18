# spirit/appServer.js

The app server of a node's process (goal/G19.1): it serves a server's verbs on its pipe, publishes its stream to its
pages and subscribers (streamPublisher), and follows another server's stream into its own data set (listener,
the client half). Since goal/G41.12 it is the one stream protocol for every server (box v15, "A better peerPost
stream"); Desk and deskClient move onto it.

## Requirements

### The family path (goal/G41.12)

- **One function, `familyPath(name)`, exported by appServer**, answers a family's own `api.js`: an app's
  `spirit/app/<name>/api.js`, the node's own `spirit/<name>/api.js` (goal/G43.20). Every caller uses it; no other file writes a family path: no `<name>.family`, no `family/api.js`, no join onto `'family'`.
  spirit.js holds the function, since the browser cannot load appServer, and appServer hands out the same one (cw,
  goal/G41.12 Q3); it is the one other file that writes the path.
- **A script of `spirit/app/<name>/` has its family at its top instead**, `api.js` and one `<verb>.json` per verb beside `<name>.js`, as
  `spirit/<family>/` has it (goal/G43.27). A client's cache finds such a family's `data.js` beside `<name>.js`. Specified in `./appServerMount.md`.
- **run://process is gone** (goal/G43.20): every server is an app of `spirit/app/`, its family at the top of its folder
  (backup, desk, deskClient); no `family/` folder is left.
- **deskAgent is killed** (Andy, goal/G41.28: *"all, KILL deskAgent!"*): no file names the server.

### Bundles (goal/G41.12)

- **Every delivery is a bundle**: one JSON array of rows in one peerPost to the subscriber's listener.
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
- **Per sender, under the run root** (where spirit.js sits; goal/G41.28, box v19: *"this way an appServer in
  client-mode can derive the name of it's ./relay-state/<appServerName>/<server-public-key-in-base64>.json"*):
  `spirit/state/<client server>/cache/<sender key>.json` (goal/G43.20: *"cache, which is written by spirit/appServer.js was
  ALWAYS supposed to go into spirit/state/<name>/cache/"*), saved as it changes and read back into the data set at start,
  before any subscribe. The key is written in base64url (Andy, on G41.28: *"Shall the server key in spirit.data and in the
  cache file name be base64url (- for +, _ for /), since a plain base64 / splits both?"* *"yes"*): no `+`, no `/`,
  and it reads back to the sender's key.
- **Its cache in spirit.data by sender node** (box v19: *"The RAM-CACHE-is organized BY SERVER-NODE-ID at it's lowest
  level. IE: spirit.data.<server-public-key-in-base64>.<api-family>...."*): the data set holds at its top the sender's
  key in base64url and nothing beside it, and under it the family (`<key>.<family>`). The test reads what the cache holds through the
  family's data.js (`spirit.data.<family>.data`), never by a branch's name.
- **It keeps every goal the sender sends**, no filtering on the client side, within its limit.
- **A sender whose family has no folder on this node** (`familyPath` of it resolved from the run root) is not cached.
- **The cache keeps to its limit, and the sender's family api.js on the client's node does the shedding**, declaring
  nothing (Andy, Q2: "it sits at the receiving end of the stream, it owns the cache, it knows the default cache limit,
  IT DOESN't HAVE ASK OR TELL ANYBODY HOW IT's JOB IS DONE"). **A family with a shed of its own is shed by it**; **a
  family with none loses its oldest rows first**, the app server's default. The desk's own rules (the goal untouched
  longest goes whole, then items, then the oldest chat lines) are judged in the desk's own test, not here (goal/G47.4).

### Its fixtures are its own (goal/G47.4)

- **No app of the tree is a fixture** (Andy: *"you make bloody well sure that such stupid hard-coded tests move"*; wsl:
  *"keep there only what is the app server's own, on your planted family"*). The stream checks follow two families
  planted in `spirit/app/` for the run and removed after: `zzstream`, a translator filing each row's item by its id
  and no cache rules; `zzshed`, a shed of its own that drops the newest rows. The family path is judged on `zzstream`;
  "no `family/` folder is left" over every app folder of the tree, read from the folder. The stateCache part plants
  `zzkept` in its scratch tree as the sender's family.

### What goes (goal/G41.12)

- The desk's own `bundled()`; deskClient's own `cache.json`. Judged in desk's and deskClient's own tests, not here (goal/G47.4): this test judges the app server. Likewise the desk folder's part of "no DEPENDENCIES"; here, no product code file names it (a test may, to look for it).

### Kept from goal/G41.11

- A subscribe follows the publisher's key and asks its family to subscribe this server; the first push lands in the
  data set.

### goal/G41.24: no DEPENDENCIES

- Andy, box: *"DEPENDENCIES will be killed, eradicated, from all code where it appears, and from the desk folder
  itself."* No code file, and no json of the desk folder, names DEPENDENCIES or hands `serve()` a dependencies list.

### goal/G43.20: no Bundles.json

- The box: *"spirit/app/desk/deskBundles.json, deskClient/deskClientBundles.json and ...
  are deleted. Bundles stay what they are, rows in node.db, made and changed through auth.bundle."* No app folder holds a
  `<name>Bundles.json`.

## Not asserted yet, and why

- **The client's query of its cache through the family api.js, and `includeServer`**, and **the client bundling its
  requests**: the box names no verb for them; the build names them, and the verify asserts them.

## The shared gate (asserted, the test's first section)

- **The shared gate, every permutation, in memory** (goal/G41.30; the box: *"Test the shared gate once, in full.
  appServer's one check guards every verb with a request shape. Every permutation is thrown at that check directly, in
  memory: thousands a second, no network."*). `matches(request, args)`, the check `route()` asks for every verb without
  a check of its own, is given request shapes of one to five keys (string, number, boolean, array, object) and one nested
  two deep. Each key gets each of the box's kinds (*"EVERY javascript object type ... PLUS: "missing" and
  "extraneous""*): JSON.parse's six types, the key missing, an extraneous key beside it; then every pair of keys in every
  pair of kinds (*"Pairs, not every combination"*), and every combination where a shape has 3 keys or fewer; a nested
  shape's inner keys each kind too. The shape's own value passes; every other is refused. The asks are counted and said,
  and must be more than 1000.
- **A verb with a check of its own skips the gate**: `route()` asks its `accepts()` alone, so garbage it lets through
  reaches its handler; a verb with none is refused that garbage `no-such-argument`.

## What its test must try to break

- The gate letting an extra key through, or a value of another type.
- A family path written anywhere but `familyPath`, or a `<name>.family` folder left.
- A delivery that is not an array, or one peerPost per backed-up row.
- A subscribe again answered with a bootstrap, a cache swept by it, missed rows not handed, a row for another key
  handed, or a full push that leaves old rows.
- A cache file missing, misnamed, not read back, kept without the switch or for a sender with no family folder, or
  past its limit; a family's own shed passed over, or the default shedding the newest.

## The agentsFile part: AGENTS.md through spirit.fs.loadFile

goal/G43.27, requirement 8. Its test, once `./appServer-agentsFile.js`, is a section of `./appServer.js`: appServer.js read as it is.

Andy: "easily changed, no?"

### Requirements

- **8. AGENTS.md through `spirit.fs.loadFile`.** appServer.js's AGENTS paragraph says AGENTS.md is read with
  `spirit.fs.loadFile` at its path, not through the family's FS.

## The mount part: moved

The node starting a server from `spirit/app/<name>/` is `./job.js`'s, its mount part (goal/G47.1); the gate going by a registered server's name is `./apiDoor.js`'s.

## The stateCache part: its cache in spirit/state/<name>/cache/

goal/G43.20, its box. Its test, once `./appServer-stateCache.js`, is a section of `./appServer.js`. Andy: *"cache, which is written by spirit/appServer.js was ALWAYS supposed to go into
spirit/state/<name>/cache/"*, and *"NO FUCKING RESCUE CODE, MOVE YOUR OWN deskClient cache where it belongs."*

A throwaway follower app planted in a lab node reset to the files under test (goal/G47.3), run as the node runs a server: a stream with
its cache on, following a sender whose family has a data.js here (`zzkept`, planted beside it). What it kept is read back at its start; then its
`saveCaches` (deskClient's `cache.dump`) writes it again. Never a live node.

### Requirements

- What it kept in `spirit/state/<name>/cache/<id>.json` comes back at its start, and its cache.dump writes
  `spirit/state/<name>/cache/<id>.json` again; no cache file is written in `spirit/state/<name>/` itself.

### What its test must try to break

- The cache read or written in `spirit/state/<name>/` itself (today: red, 3 of 6).
- A rescue that reads or moves the old file.

### The attacker (rule/27)

Each case spoils `cache/` before the follower starts, and it must still start and save:
- a file named for one sender holding another's key: not read;
- only a half-written `<id>.json.tmp`, as a kill leaves it: not read;
- a file that is no JSON, and one of the wrong shape (`rows` no list, `run` a number, `n` negative): nothing read back.
- After all of it `spirit/state/follower/` holds nothing beside `cache/`, `data/`, `node.json` and its socket.

## remote: one server, two modes (goal/G47.5, box v12)

Andy: *"for a always-on server it would always run in one of two modes. by default it runs in server mode."*, *"go"*.
Asked of the one-process server on its pipe, this node SELF, the sibling PUBLISHER (whose family under its key answers
ping as the sibling):

- remote is an auto-verb: the api tree names it.
- Called empty by the owner it answers `{ current, items, more }`, current this node in server mode; its list holds this
  node first, each row only a key and a label. A peer asking remote is refused.
- `remote { id: PUBLISHER }` switches to client mode and answers `{ current }` alone, naming that peer; the choice is kept
  in `spirit/state/<appServerName>/remote.json`.
- In client mode the owner's ask goes to the sibling and its answer comes back; a peer's post is refused with a code
  saying it is in client mode; the chosen sibling's publishings still land.
- In client mode a row only the sibling sent, delivered to this server's listener, is published to this node's own
  pages too (box: "the replies and reply stream data are cached as they are now, but also published to its own faces").
- `remote { id: SELF }` switches home: `{ current }` is this node and its own verb answers again.
- deskClient still follows the desk (box: "a red checks that deskClient still follows the desk after the change"):
  deskClient's own test, "it serves its verbs and follows the desk's stream", is that check.
- Publishing (box v12, "only to its own loopback clients and its relay-face, never to the peers subscribed to it"): a
  switch publishes remote, current and the list, to its own pages (the stand-in's event.publish); no delivery to a peer
  subscribed to it carries remote.
- The background check (box v12, "one row per peer that lets this node into this app", "leisurely asks again in the
  background"): the stand-in's contacts are one that lets this node in (its server refuses remote only as owner-only), one whose server loads but refuses it
  (not-granted), and one that stays silent. After an empty call and a wait, the list holds this node and the first alone,
  and remote.json keeps the first and not the refusing one. Loading a peer's interface is not being let in.
- The listen verb is listener (Andy: *"PLEASE call the damn thing jus \"listener\", we won't start using camelCase on
  intrinsic verbs"*): the test's deliveries post listener, and the stand-in's families answer listener.
- The listener and the publisher's verbs are auto-verbs of every appServer (Andy: *"they're both auto-verbs. MUST BE."*):
  a server with a publisher only (as the desk is) and one with a stream only (as deskClient is), each a child process,
  name listener, subscribe, unsubscribe and remote, and no listener.

## Loopback beside owner (goal/G47.5)

Andy: *"the checkmark in the agent-bubble that can only be set via loopback"*; Q8, the shared server code tells a server
loopback beside owner. The test's server answers whoami with what it was told of its caller:

- the owner's call through the loopback door (X-Spirit-Owner and X-Spirit-Loopback) reaches it as owner and loopback;
- the owner's call without the loopback mark reaches it as owner, not loopback.

## Each subscriber's return address, kept (goal/G47.5)

Andy: *"so the \"subscribe\" verb needs to carry a return address."*, *"it probably needs to be stored in the server-apps
node-owned state? spirit/state/<server-app>/clientListeners.json"*, *"go!"*. The file's shape is the builder's:

- a subscribe writes its key and the branch it names to spirit/state/<server>/clientListeners.json;
- an unsubscribe takes its key out.
