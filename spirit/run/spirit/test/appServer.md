# spirit/appServer.js

The app server of a node's process (goal/G19.1): it serves a server's verbs on its pipe, publishes its stream to its
pages and subscribers (streamPublisher), and follows another server's stream into its own data set (streamListener,
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
- **Per sender, under the run root** (where spirit.js sits; goal/G41.28, box v19: *"this way an appServer in
  client-mode can derive the name of it's ./relay-state/<appServerName>/<server-public-key-in-base64>.json"*):
  `spirit/state/<client server>/cache/<sender key>.json` (goal/G43.20: *"cache, which is written by spirit/appServer.js was
  ALWAYS supposed to go into spirit/state/<name>/cache/"*), saved as it changes and read back into the data set at start,
  before any subscribe. The key is written in base64url (Andy, on G41.28: *"Shall the server key in spirit.data and in the
  cache file name be base64url (- for +, _ for /), since a plain base64 / splits both?"* *"yes"*): no `+`, no `/`,
  and it reads back to the sender's key.
- **Its cache in spirit.data by sender node** (box v19: *"The RAM-CACHE-is organized BY SERVER-NODE-ID at it's lowest
  level. IE: spirit.data.<server-public-key-in-base64>.<api-family>...."*): the data set holds at its top the sender's
  key in base64url and nothing beside it, and under it the family (`<key>.desk`). The test reads what the cache holds through the
  family's data.js (`spirit.data.desk.data`), never by a branch's name.
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
  past its limit.

## The agentsFile part: AGENTS.md through spirit.fs.loadFile

goal/G43.27, requirement 8. Its test, once `./appServer-agentsFile.js`, is a section of `./appServer.js`: appServer.js read as it is.

Andy: "easily changed, no?"

### Requirements

- **8. AGENTS.md through `spirit.fs.loadFile`.** appServer.js's AGENTS paragraph says AGENTS.md is read with
  `spirit.fs.loadFile` at its path, not through the family's FS.

## The mount part: the node starts a server from spirit/app/<name>/

The node starts a server from `spirit/app/<name>/` (goal/G43.12). Its test, once `./appServer-mount.js`, is a section of `./appServer.js`. A real node runs on a scratch copy of the tracked files, with throwaway apps planted in that copy (`probe`, `quiet` with `node.mount` false and no `data.js`, so no one-shot app either (goal/G43.19, box v16, 2), `always` intrinsic). The tree's own server app (`agent`) is not what it judges. Nothing is kept in the repo.

Andy: *"JUST loading functional server and associating the <name> as "familiy" name, in the new namespace"*.

### Requirements

#### Starting and stopping

- It starts only if `<name>.json` says `node.mount` true and `spirit/state/<name>/node.json` says `active` true. Neither alone starts it.
- `active` starts and stops it while the node runs, through `app.active`, with no restart of the node.
- `active` is the one switch. `node.json` holds no `running`. A killed server comes back and `active` stays true.
- `active` true starts it at every boot, after a clean stop and after a power cut that left its door behind. `active` false does not.
- Turning `active` off keeps the row in the list, with `active` false. A stopped server stays stopped.

#### What it is in the node

- `<name>` is its family in the flat table, and its verb answers through the node.
- its family is at its top, `api.js` beside `<name>.js`, as `spirit/<family>/` has it (goal/G43.27). The interface reads the app folder, and so does `fs.load` of a path in it; the branch carries no FS set (goal/G43.20). A `family/` folder beside it is ignored.
- `<name>.json` has no `kind` or `operated`. The node operates the server.
- Its module id is `spirit.app.<name>`.
- Its door is a socket in `spirit/state/<name>/`, on POSIX. None is in its `data/`.
- The node hands it `spirit/state/<name>/data` as `--state`.

#### Pages and processes

- A page binds the family by its name, and its verb answers.
- `data.js` beside `<name>.js` is found on a page, in a process, and for a client's cache: what a client kept of a sender in the new family comes back at its start, as it does for a node family (contact).
- The one `<name>.js` also runs on a page.

#### The start rule (goal/G43.20: "jobs.create starts only an app's own script, spirit/app/<name>/<name>.js, of an app whose <name>.json says node run true")

- A script of an app is refused and does not run, its server script included when its json says node mount and not node run.
- A helper of an active app is refused too: *"A second script in an app folder is therefore never started."*
- Refused and not run: a script of the shell, a file at the top of `spirit/app`, the same path in another tree, and a way out of an app's folder by dots.

#### What stays

- A script outside `spirit/app/` is refused `not-a-process`.
- A member without a grant is refused and no server is asked. A member granted `<name>.ping` reaches it.

#### Intrinsic (goal/G43.14)

- A server app whose `<name>.json` says `identity.intrinsic` true runs from the boot with nothing pressed, and nothing is written to its `node.json`.
- `app.active` with false does not stop it.

### Not judged here

- What the box puts out of this item: bundles, the process-less face-app, the app key, faces and puppets, and a name in both places.

## The stateCache part: its cache in spirit/state/<name>/cache/

goal/G43.20, its box. Its test, once `./appServer-stateCache.js`, is a section of `./appServer.js`. Andy: *"cache, which is written by spirit/appServer.js was ALWAYS supposed to go into
spirit/state/<name>/cache/"*, and *"NO FUCKING RESCUE CODE, MOVE YOUR OWN deskClient cache where it belongs."*

A throwaway follower app planted in a scratch copy of the tracked files, run as the node runs a server: a stream with
its cache on, following a sender whose family has a data.js here (desk). What it kept is read back at its start; then its
`saveCaches` (deskClient's `cache.dump`) writes it again. Never a live node.

### Requirements

- What it kept in `spirit/state/<name>/cache/<id>.json` comes back at its start, and its cache.dump writes
  `spirit/state/<name>/cache/<id>.json` again; no cache file is written in `spirit/state/<name>/` itself.
- No rescue: a cache file at the old place, `spirit/state/<name>/<id>.json`, is not read back, and it is left where it was.

### What its test must try to break

- The cache read or written in `spirit/state/<name>/` itself (today: red, 3 of 6).
- A rescue that reads or moves the old file.

### The attacker (rule/27)

Each case spoils `cache/` before the follower starts, and it must still start and save:
- a file named for one sender holding another's key: not read;
- only a half-written `<id>.json.tmp`, as a kill leaves it: not read;
- a file that is no JSON, and one of the wrong shape (`rows` no list, `run` a number, `n` negative): nothing read back.
- After all of it `spirit/state/follower/` holds nothing beside `cache/`, `data/`, `node.json` and its socket.
