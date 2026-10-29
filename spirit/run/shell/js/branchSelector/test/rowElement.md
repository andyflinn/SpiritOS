# branchSelector/rowElement.js

`spirit/run/shell/js/branchSelector/rowElement.js` is one branch as a row element (goal/G41.14), as
`shell/js/contacts/rowElement.js` is one contact. The branch list draws its rows with it. Its test is `./rowElement.js`.

Andy, box: *"branchSelector:pane, with table columns as follows: 1. Family (duh?) 2. Verb 3. armingButton 'Delete'"*,
and *"A branch row with an empty verb shows as \"(ALL)\", as the filter does."*

## Requirements

- It loads what it uses itself (rule/26): `shell/js/rowElement.js` and `shell/js/armingButton.js`.
- It registers `spirit.elements.branchElement.create(row)`: a row element of kind `branch`, keyed by the branch's id.
  Its row is the branch as `auth.branch` answers it, `{ id, bundle, family, verb }`.
- Its fields are `family`, `verb` and `delete`, in that order. Family and verb are drawn escaped; an empty verb shows as
  `(ALL)`. Delete is a button naming its action.
- It repaints from the data set (goal/G41.14): when `data.branches/<its id>` changes, as the node's stream sets it
  (the list element takes it from the node's stream), its fields repaint; another branch's row changes nothing.
- Mounted, its Delete is an `armingButton`: the first press asks nothing, the second asks
  `auth.branch { op: 'delete', id }`.

## What its test must try to break

- A part counted on that the row did not load itself.
- A verb drawn unescaped, or an empty verb drawn empty.
- A Delete that asks on the first press, or deletes another branch.
