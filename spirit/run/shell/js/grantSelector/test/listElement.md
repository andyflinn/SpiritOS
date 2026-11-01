# grantSelector/listElement.js

`spirit/run/shell/js/grantSelector/listElement.js` is the grant list (goal/G41.14), of whichever grants table its caller
hands it (goal/G41.16). The grants panel draws it. Its test is `./listElement.js`.

## Requirements

- It loads what it uses itself (rule/26): `shell/js/probabilitySearch.js` and `shell/js/grantSelector/rowElement.js`; no
  data script.
- It names no table and no branch of its own. `grantList.create(host, { grants, filters, selectors, serves, api })`: `grants` the
  caller's grants table, as the row element takes it, with `search(text)` beside it, answering `{ items, more }`. Made
  with no grants table, it is refused and draws nothing.
- It draws one probabilitySearch pane into `host`, and fills it as soon as it is drawn.
- It hears its table's grants on the stream from the moment it is made: a list with no row drawn yet hears its first
  grant, into its table's branch (found live by cw, goal/G41.16).
- It is a view of the branch its table names (`grants.branch`), which the row element keeps from the stream.
- Its search is the table's `search(text)`, the text trimmed, answered as a reply.
- Its columns are `name` (whose grant), `path` and `revoke`, Revoke the rightmost. Each row is a `grantElement`, handed
  the same table and `serves`.
- It hands its search no `matched()`: the whole row is matched (goal/G41.28; Andy, box v15: *"All client side searches will be fixed, too, and search the whole row, as cached in spirit.data."*).
- `filters` are its own: the page hands them. So are `selectors`, handed to the search as they are, for its 🪣 row
  (goal/G41.26).
- `refresh()` and `destroy()` reach the search element; `.list` is it.

## What its test must try to break

- A table or branch named in the list itself, or a list made with no table.
- A search asked anywhere but the table's.
- A row handed another table, or a `matched()` handed to its search.
- Revoke anywhere but the rightmost column.
- An empty list that never hears its first grant.
