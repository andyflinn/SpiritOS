# spirit/authTableInterface.js

One interface to an auth table, by its database file, its table and its key column (goal/G41.4). Andy: "node's auth
modules will have a file authTableInterface.js, (configured by dataBase.db file name and authTableName)", and the agent
app's grant table is "structured exactly like the auth table in node".

## Requirements

- **`open(dbFile, table, keyColumn)`** answers `{ has, paths, grant, revoke, all, knownPath }`, the names node's auth
  uses today (cw, for the build).
- It makes the table in that file, keyed `(keyColumn, path)`, one row per grant, as node's grants are `(peer_id, path)`
  (spirit/nodeStore.js:502).
- `grant(key, path)` gives it once; `has(key, path)` is true for a grant given and false for any other; `paths(key)`
  answers that key's paths, each once; `revoke(key, path)` removes that grant alone; `knownPath(path)` says whether any
  key holds it; `all()` answers every grant.
- Opened again on the same file, the grants are there. Configured as node's (`grants`, `peer_id`), it is node's shape
  exactly.

## Not asserted here

- Whether node itself reads its grants through it (nodeStore moving onto it): the box leaves it open.
