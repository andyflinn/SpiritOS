# grantSelector/rowElement.js

`spirit/run/shell/js/grantSelector/rowElement.js` is one grant as a row element (goal/G41.14), of whichever grants table
its caller hands it (goal/G41.16): the node's grants of contacts, or the agent's grants by job. The grant list draws its
rows with it. Its test is `./rowElement.js`.

Andy, goal/G41.16: *"the callers (Grants and agent shell apps should boody well know how to configure the damn
grantsPanel element"*: the row knows no table.

## The grants table it is handed

`grantElement.create(row, { grants, serves, api })`, `grants` the caller's configuration of one grants table:

- `branch`: the data branch its grants are kept in (`grants`, `agent.grant`);
- `key`, `label`: the fields of a grant row holding its ID and whose grant it is (`key`/`label`, `job_id`/`job`);
- `revoke(id, path)`: how a grant is revoked;
- `stream(job)`: which stream rows are its grants: `{ row, gone }` for one, nothing for any other.

## Requirements

- It loads what it uses itself (rule/26): `shell/js/rowElement.js` and `shell/js/armingButton.js`; no data script.
- It names no table: no auth verb, no agent grant, no stream job of its own. Made with no grants table, it is refused.
- A row element of kind `grant`, keyed `<id>\n<path>`, the id read from the table's key field.
- Its fields are `name`, `path` and `revoke`, Revoke the rightmost. Whose grant it is (the table's label field) and the
  path are drawn escaped.
- Mounted, its Revoke is an `armingButton`: the first press asks nothing, the second revokes through the table,
  `revoke(id, path)`.
- It takes each table's grant rows from the stream itself, its kind's index (`shell/js/rowElement.js`, G30.18): a row
  its table's `stream(job)` calls a grant lands in that table's branch, `<branch>/<id>\n<path>`; gone takes it out. One
  table's grants never land in another's branch. A row no table calls a grant, or a grant with no id or path, writes
  nothing.
- It repaints from its table's branch: its row there changed, whose grant it is repaints; another grant, or the same id
  in another table's branch, changes nothing.

## What its test must try to break

- A table, verb or stream job named in the row itself, or a row made with no table.
- An id or label read from a field the table did not name.
- A Revoke that asks on the first press, or revokes through anything but its table.
- One table's grants landing in another's branch.
