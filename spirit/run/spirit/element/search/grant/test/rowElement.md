# spirit/element/search/grant/rowElement.js

`spirit/run/spirit/element/search/grant/rowElement.js` is one grant as a row element (goal/G41.14), of whichever grants table
its caller hands it (goal/G41.16): the node's grants of contacts, or the agent's grants by job. The grant list draws its
rows with it. Its test is `./rowElement.js`.

Andy, goal/G41.16: *"the callers (Grants and agent shell apps should boody well know how to configure the damn
grantsPanel element"*: the row knows no table.

## The grants table it is handed

`spirit.element.search.grant.rowElement.create(row, { grants, serves, api })`, `grants` the caller's configuration of one grants table:

- `branch`: the data branch its grants are kept in, a whole `spirit.data` path, node/family/branch (goal/G41.28): the
  node's grants are the auth family's cache manager's (`spirit.data.auth.data.grants.branch`, as `shell/grants/grants.js`
  configures them), another table names one of its own;
- `key`, `label`: the fields of a grant row holding its ID and whose grant it is (`key`/`label`, `job_id`/`job`);
- `revoke(id, path)`: how a grant is revoked;
- `watch(fn(id + newline + path, row))`: its rows' changes, from its family's cache manager (the node's grants:
  `spirit.data.auth.data.grants.watch`, goal/G41.28), answering its release. A table without one is no table: the row has no
  Revoke.

## Requirements

- It loads what it uses itself (rule/26): `spirit/element/rowElement.js` and `spirit/element/armingButton.js`; no data script.
- It names no table: no auth verb, no agent grant, no job of its own. Made with no grants table it throws nothing (goal/G41.19, box v23: *"throws nothing even when unconfigured"*): it is a row of nothing, and never falls back to one.
- A row element of kind `grant`, keyed `<id>\n<path>`, the id read from the table's key field.
- Its fields are `name`, `path` and `revoke`, Revoke the rightmost. Whose grant it is (the table's label field) and the
  path are drawn escaped.
- Mounted, its Revoke is an `armingButton`: the first press asks nothing, the second revokes through the table,
  `revoke(id, path)`.
- It translates no stream (goal/G41.28): a table's rows are its family's cache manager's, never the row's.
- It repaints from its table's watch: its row there changed, whose grant it is repaints; another grant, or the same id
  in another table's branch, changes nothing.

## What its test must try to break

- A table, verb or job named in the row itself, a translator of its own, or a row made with no table or no watch.
- An id or label read from a field the table did not name.
- A Revoke that asks on the first press, or revokes through anything but its table.
- One table's change repainting another table's row.
