# spirit/nodeStore.js — its own test

The node's machine state on disc: one sqlite file, `spirit/state/node.db` under a node home, holding the one table of
known IDs (`seen`), the post queue and its backoff, the replay index, the node log
(`traffic`), the API grants and the bundles with their branches. Owed since the rule *"every production script has its
own test"* (goal/G47.1, box v72). On a scratch folder under the OS temp dir, every row written and read back through
the module's own functions.

## Requirements

### The module

- `available()` is true where `node:sqlite` loads. `dbPath(root)` is `<root>/spirit/state/node.db`. `MAX_DB_BYTES` is
  16 MB (goal/G30.19, Andy: *"cap in to 16 MB"*).
- `open(root)` makes `spirit/state/` and the file, and answers one store per resolved home: a second `open` of the same
  home, however spelled, is the same store. `store.path` is the file.
- `close()` lets the home be opened again as a new store, with every row written before still there; closing twice
  does no harm.
- Durability: rollback journal (no `-wal` file beside it, no journal left after a commit), `auto_vacuum` incremental,
  and `secure_delete` on: a row forgotten leaves the disc, not only the index.

### `seen`, the one table of known IDs (goal/G40.11)

- `put(key, what)` makes the row or updates it greedily: a label is taken only when given and its rank is no worse
  (`<=`) than the one held, with its rank and `labelAt`; `present` is three-valued (true, false, or nothing said, which
  leaves the held value and reads as `null` on a new row); `firstSeen` is written once, `lastSeen` every time; `relay`
  only ever goes from false to true. Answers the row as it now reads.
- `get(key)` is that row (flags as booleans, texts `''` when unset), `null` for an unknown key.
- `set(key, fields)` writes only the fields given: the six flags (booleans only), `myLabel`, `card`, `face`, `url`
  (strings only); makes a row with dates 0 and presence unknown when there is none; `firstSeen` only on a row that has
  none. An empty or blank key is refused with `null`.
- `flagged(flag)` is every row with that flag, newest `lastSeen` first; an unknown flag is `[]`. `listed()` is the kept
  and the owned, each once. `byUrl(url)` is the relay row holding that address, `null` for none or for `''`.
- `forget(key)` deletes the row and says whether there was one. `size()` counts rows. `clear()` empties the table and
  answers how many went.
- `onChange(fn)`: every write that changes a row hands the row as it now reads, `{publicKey, gone: true}` once
  forgotten; a write that changes nothing hands nothing; a listener that throws stops neither the write nor the next
  listener; the answered function stops it; a non-function is refused with a no-op.
- `sheddable()` counts the rows with neither keep nor mine. `sweepToBytes(cap)` sheds until `bytes()` fits: unflagged
  rows first, then ignored or blocked, oldest `lastSeen` first in each; keep and mine never. A cap of 0 or less, or one
  already met, sheds nothing. `bytes()` is the table's own pages, `fileBytes()` the whole file.

### `traffic`, the node log (transport/R19.3)

- `add(row)` answers a seq that only grows; `all()` gives each row back exactly as written: text, numbers, `true` and
  `false` in their own types; a value not of its column's type and a field no column names go to `extra` and come back
  unchanged. A null row is an empty row.
- `byHash(hash)` the rows with that hash, never for `''`; `arrivals(since, limit)` the `dir: 'in'`, `outcome: 'delivered'`
  rows after `since`, oldest first, at most `limit`. There is no reader of owner rows (goal/G47.1, Q16).
- `untaken()` is the delivered arrivals of the last day with no `mark: 'taken'` row of the same hash, oldest first.
- `lastAt()` the newest `at`, `''` when empty; `count()`; `bytes()`.
- The file never grows past `MAX_DB_BYTES`: past it the oldest log rows go, never the one just written.

### `replay`, the recipient's replay index

- `ms(at)` takes a number as is, an ISO string as its milliseconds, anything else as 0.
- `seen(hash, at, now)` answers `'new'`, `'again'` once remembered, `'old'` past `WINDOW_MS` (one day) or for no hash,
  `'ahead'` past `SKEW_MS` (one hour) in the future.
- `remember` keeps a hash once; `sweep(now)` drops what is older than the window and answers how many; `rebuild(rows)`
  takes `{hash, at}` rows, skips a row with no hash, is safe to run twice, and answers how many it took; `count()`.

### `queue` and `backoff`, the post queue (cycle R16)

- `queue.put(row)` answers its seq, the next after the highest when none is given; a second put of the same hash
  changes only attempts and untilWall. `attempts(hash, n)`, `del(hash)` (whether it was there), `all()` in seq order.
- `backoff.put(relayUrl, toKey, untilWall, lastWait)` one row per pair, a second put replacing it; `del`; `all(now)`
  drops the ones run out by `now` first.

### `auth`, `bundles`, `branches` (apiAuth/G1.3, goal/G41.14)

- `grant(key, path, label)` adds a grant, and writes `label` as the row's `myLabel` only when it has none; a second
  grant of the same pair throws and leaves one. `has`, `paths` (sorted), `peer`, `all`, `knownPath`. `label(key)` is
  `null` for a key with no grant, else its myLabel, else its label, else `''`. `revoke` says whether it went;
  `relabel` refuses a key with no grant.
- `bundles.add(label, owner)` answers a number id, owner `'node'` when not given; `get`, `all` in label order, `set`
  renames, `del` takes its branches with it. `branches.add/get/all/set/del`; `same(bundle, family, verb, id)` finds
  another branch of the bundle naming the same, the branch itself left out.
- `transaction(fn)` answers what fn answers, and rolls every write back when fn throws.

## What its test must try to break

A label downgraded by a less sure source; a silent caller marking somebody absent; firstSeen moved; a relay flag taken
away by a put; a non-boolean flag written; a row made for a blank key; a change event for a write that changed nothing;
a kept or owned row shed; an ignored row shed while an unflagged one is left; true read back as 1; a field lost; an
untaken packet that was taken, or a day old; the file past its cap, or the packet just written shed; a replayed hash
read as new; a queue put that resets a row's body; a grant label
overwriting the owner's name; a bundle's branches left behind; a transaction's writes kept after a throw; a reopen that
lost the rows.
