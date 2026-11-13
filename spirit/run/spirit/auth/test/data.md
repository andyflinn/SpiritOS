# spirit/auth/data.js — its own test

What a client knows of a node's bundles, branches and grants (goal/G41.28; Andy: *"We're not done until every family of
the API tree as a clientCacheManager"*), from the node's own job `spirit.auth` (goal/G43.20): `{ table, row, gone }`.
Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs beside the real `spirit/data.js`; the test reads through `spirit.data.auth.data` alone, never a branch.

- In node, `spirit.cacheManager('auth')` finds it, at `spirit.data.auth.data`.
- A **bundle** row is kept by its number id as `{ id, label, owner }`, the owner as the node said it; one that names no
  owner keeps none (goal/G41.25). A **branch** row as `{ id, bundle, family, verb }`. A **grant** row whole, by
  `grantKey(key, path)`, the key, a newline and the path.
- A row `gone` is let go in each table. A row with no id, a grant with no path, a job of another id keep nothing.
- Each table's reads: `row(id)` (null for no id), `rows()`, `watch(fn)` (the row's id and row, undefined once gone;
  answers its release), `branch` (the whole path, under the node that served it).
- A row from another node is filed under that node, never among the first node's rows.

## What its test must try to break

- An owner invented for a bundle row that named none; a branch or grant row kept under the wrong table.
- A row gone that stays; a watcher heard after its release.
- Two nodes' rows mixed in one view.
