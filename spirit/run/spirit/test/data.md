# spirit/data.js

The faceless layer: one tree, a branch per type, mirroring the shell's partner node. Lists are views of it. It touches
no page, so it runs in node, where `require` answers the api.

## API

- The tree is per family: `spirit.data.<family>.cache[node][branch][row] -> value` (goal/G43.7); the test reads it there.
- `setPath(path, v)`, `mergePath(path, fields)` and `delPath(path)` write. A path is `'<node>/<family>/<branch>/<key>'` (goal/G41.28;
  Andy, the box: *"spirit.data.<server-public-key-in-base64url>.<api-family>...."*), node the serving node's key in
  base64url (`nodeId(key)`), and a key may hold slashes. `viewAt(node, family)` is a family's view: `get`, `set`, `merge`,
  `del`, `watch`, `rows`, `seat`, `ready`, `quietly` and `branch`, given `'<branch>/<key>'`. The test writes and reads
  through one such view, its node a key holding a `+` and a `/`.
- Below, `get`, `branch`, `watch`, `rows`, `seat`, `quietly` and `ready` are the view's verbs; on `spirit.data` itself they are `getPath`, `branchAt`, `watchPath`,
  `rowsOf`, `seatRows`, `setQuietly` and `readyBranch`, each given a whole path.
- `get(path)` gives a value, or with a bare type the whole branch. `branch(type)` gives the branch; a missing one answers empty, for a read makes nothing (goal/G41.28).
- `watch(path, fn)` returns its unwatch. `rows(type)` gives `[{ key, ...value }]`.
- `seat(type, items)` merges a search answer's `{ key, label: json }` items.
- `addTranslator(t)` registers a type's translator. `takeJob(job)` and `takeRename(d)` feed it by hand.
- `quietly(type, on)` and `ready(type, now?)` control a quiet fill.
- `searchAll({ text, branches, room })` gives `{ items: [{ key: <the row's whole path>, label, probability }], more }`.
- `forgetAll()` and `byteCap(n?)` are the cache's life, below; `allBranches()` lists every branch's whole path.

## Requirements

- **set**:
  - Stores the value at its key and tells the watchers of that path and of its type, each with `(path, value)`.
  - A path without a key (`'files'`, `'files/'`, `''`) writes nothing and tells nobody.
  - Everything after the first `/` is the key.
- **merge** writes the old value with the new fields over it. On a missing key it starts from `{}`.
- **del**:
  - Removes the key and tells the watchers with `undefined`.
  - A key that is not there tells nobody.
- **watch**:
  - The watcher is called until it is unwatched.
  - A watcher that throws costs the other watchers nothing.
  - A non-function gives a harmless unwatch.
- **rows** gives one row per key, with the key added. It is a copy: changing a row does not change the tree.
- **seat** merges each item whose label is a JSON object. A null item, an item with no key, or a label that is not a
  JSON object is skipped.
- **addTranslator**:
  - `takeJob(job)` calls each translator's `onJob(job, api)` for every job, data or none (the jobs family keeps them whole), never for `null`.
  - `takeRename(d)` calls each translator's `onRename(d, api)`, and only when `d.key` is set.
  - A translator that throws costs the others nothing. A non-object is not registered.
- **quietly and ready**:
  - While `quietly(type, true)`, writes to that type land and tell nobody.
  - Other types still tell.
  - `ready(type, true)` sets the flag, ends the quiet, and tells the type's watchers once with `(type, undefined)`.
  - `ready(type)` reads the flag.
- **searchAll**:
  - Weighs every row of every branch, or of the branches named, against the text, and ranks the best first.
  - A row the text misses still comes back, with probability 0.
  - Without text, every row comes back with probability 0.
  - The label is the row as JSON, and the key is the row's whole path; `branches` names whole branch paths.
  - The answer `{ items, more }` fits `room` bytes. When rows are left out, `more` is true.
  - A single row too big for the room is left out and sets `more`.
  - It writes nothing to the tree and tells no watcher.

- **The cache's life** (goal/G41.3, Q2):
  - `forgetAll()` empties every branch and every ready flag, and tells each type's watchers once with `(type, undefined)`.
  - On a page every snapshot is a connect: the cache forgets first, then takes the partner's whole push. A row a search
    seated is forgotten too.
  - On a page a translator registered late is handed every job as it now stands, each once, and every rename heard, so
    its branch is whole at once.
  - In a process the cache has a byte cap (`byteCap()` reads it, `byteCap(n)` sets it). Past it the oldest writes go first,
    each told as a delete, and a row written again is newest again. On a page `byteCap()` is `Infinity`: no cap (box v17).

## What its test must try to break

- Keys with slashes.
- Empty keys.
- A delete of a missing key.
- A throwing watcher.
- Unwatching inside a run.
- A garbage label.
- A job without data.
- A quiet fill seen by a watcher.
- A tiny room.
- A branch filter.
- A search that writes.
