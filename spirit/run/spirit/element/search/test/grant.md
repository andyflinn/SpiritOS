# spirit/element/search/grant.js

`spirit/run/spirit/element/search/grant.js` is the grant list (goal/G41.14), of whichever grants table its caller
hands it (goal/G41.16). The grants panel draws it. Its test is `./grant.js`.

## Requirements

- It loads what it uses itself (rule/26): `spirit/element/search.js` and `spirit/element/search/grant/rowElement.js`; no
  data script.
- It names no table and no branch of its own. `spirit.element.search.grant.create(host, { grants, filters, selectors, serves })`: `grants` the
  caller's grants table, as the row element takes it, with `search(text)` beside it, answering `{ items, more }`. Made
  with no grants table, it throws nothing and draws only a note that it is not configured.
- It draws one probabilitySearch pane into `host`, and fills it as soon as it is drawn.
- It is a view of the branch its table names (`grants.branch`, a whole `spirit.data` path, goal/G41.28), which the
  table's cache manager keeps: a grant landing there before any row is drawn is in the list.
- Its search is the table's `search(text)`, the text trimmed, answered as a reply, handed to the probabilitySearch as
  its own data source (`options.search`), never as an api (goal/G43.24).
- Its columns are `name` (whose grant), `path` and `revoke`, Revoke the rightmost. Each row is a grant row element (`spirit/element/search/grant/rowElement.js`), handed
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
