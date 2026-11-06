# branchSelector/rowElement.js

`spirit/run/spirit/element/search/branch/rowElement.js` is one branch as a row element (goal/G41.14), as
`spirit/element/search/contact/rowElement.js` is one contact. The branch list draws its rows with it. Its test is `./rowElement.js`.

Andy, box: *"branchSelector:pane, with table columns as follows: 1. Family (duh?) 2. Verb 3. armingButton 'Delete'"*,
and *"A branch row with an empty verb shows as \"(ALL)\", as the filter does."*

## Requirements

- It loads what it uses itself (rule/26): `spirit/element/rowElement.js` and `spirit/element/armingButton.js`.
- It registers `spirit.element.branchElement.create(row)`: a row element of kind `branch`, keyed by the branch's id.
  Its row is the branch as `auth.branch` answers it, `{ id, bundle, family, verb }`.
- Its fields are `family`, `verb` and `delete`, in that order. Family and verb are drawn escaped; an empty verb shows as
  `(ALL)`. Delete is a button naming its action.
- It repaints from the data set (goal/G41.14): when its row in the auth family's branches (`spirit.data.auth.data.branches.row(<its id>)`; goal/G41.28,
  `<node>/auth/branches/<id>` in `spirit.data`) changes, as the node's stream sets it
  (as it takes it from the node's stream), its fields repaint; another branch's row changes nothing.
- Mounted, its Delete is an `armingButton`: the first press asks nothing, the second asks
  `auth.branch { op: 'delete', id }`.

- The node's branch rows are taken from the stream by the auth family's cache manager
  (`spirit/run/spirit/auth/data.js`, goal/G41.28), which the row element loads itself
  (`spirit.cacheManager('auth')`; G41.14 until then, its own translation), into `spirit.data.auth.data.branches`: the node publishes each changed row of its two
  bundle tables on one permanent job of type `bundles`, `{ table, row }`, and `{ table, row: { id }, gone: true }`. A row
  published is kept by its id, published again replaces it, gone takes it out; the other table's rows, another job's, and
  a row with no id write nothing. It requires no data script.

## What its test must try to break

- A part counted on that the row did not load itself.
- A verb drawn unescaped, or an empty verb drawn empty.
- A Delete that asks on the first press, or deletes another branch.
