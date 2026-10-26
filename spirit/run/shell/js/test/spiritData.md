# shell/js/spiritData.js

The faceless layer: one tree, a branch per type, mirroring the shell's partner node. Lists are views of it. It touches
no page, so it runs in node, where `require` answers the api.

## API

- `data` is the tree: `type -> key -> value`.
- `set(path, v)`, `merge(path, fields)` and `del(path)` write. A path is `'<type>/<key>'`, and a key may hold slashes.
- `get(path)` gives a value, or with a bare type the whole branch. `branch(type)` gives the branch, made if missing.
- `watch(path, fn)` returns its unwatch. `rows(type)` gives `[{ key, ...value }]`.
- `seat(type, items)` merges a search answer's `{ key, label: json }` items.
- `translate(t)` registers a type's translator. `take(job)` and `rename(d)` feed it by hand.
- `quietly(type, on)` and `ready(type, now?)` control a quiet fill.
- `search({ text, branches, room })` gives `{ items: [{ key: '<type>/<key>', label, probability }], more }`.

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
- **translate**:
  - `take(job)` calls each translator's `onJob(job, api)`, and only when the job carries `data`.
  - `rename(d)` calls each translator's `onRename(d, api)`, and only when `d.key` is set.
  - A translator that throws costs the others nothing. A non-object is not registered.
- **quietly and ready**:
  - While `quietly(type, true)`, writes to that type land and tell nobody.
  - Other types still tell.
  - `ready(type, true)` sets the flag, ends the quiet, and tells the type's watchers once with `(type, undefined)`.
  - `ready(type)` reads the flag.
- **search**:
  - Weighs every row of every branch, or of the branches named, against the text, and ranks the best first.
  - A row the text misses still comes back, with probability 0.
  - Without text, every row comes back with probability 0.
  - The label is the row as JSON, and the key is `'<type>/<key>'`.
  - The answer `{ items, more }` fits `room` bytes. When rows are left out, `more` is true.
  - A single row too big for the room is left out and sets `more`.
  - It writes nothing to the tree and tells no watcher.

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
