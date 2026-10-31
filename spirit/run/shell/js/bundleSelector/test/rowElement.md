# bundleSelector/rowElement.js

`spirit/run/shell/js/bundleSelector/rowElement.js` is one bundle as a row element (goal/G41.14), as
`shell/js/contacts/rowElement.js` is one contact. The bundle list draws its rows with it. Its test is
`./rowElement.js`.

Andy, box: *"these shell elements must follow the design pattern of the contactSelector, with a sibling folder for a
listElement.js and a rowElement.js script to fit within the probabilitySearch framework."*

## Requirements

- It loads what it uses itself (rule/26): `shell/js/rowElement.js`, `shell/js/fieldInput.js` and
  `shell/js/armingButton.js`, through `spirit.require`.
- It registers `spirit.elements.bundleElement.create(row, opts)`: a row element (`shell/js/rowElement.js`) of kind
  `bundle`, keyed by the bundle's id. Its row is the bundle as `auth.bundle` answers it, `{ id, label }`.
- Its fields are `label`, `owner`, `edit` and `delete`, in that order (goal/G41.25: the owner *"displayed right after
  the bundles label"*). The owner is drawn escaped, as the bundle names it, and never as an input: *"the owner field
  can never be changed after a bundle is added"*. The label is drawn escaped. Edit and Delete are buttons
  naming their action.
- With `opts.editable`, the label is edited in place (Andy: *"[fieldInput:fieldRule:Label], displays and updates the
  bundle's label"*):
  - mounted, its label cell holds an input showing the label, a `fieldInput` held to the label's rule;
  - Enter, or leaving the field, with a valid label asks `auth.bundle { op: 'set', id, label }`; the answer draws nothing
    by itself (rule/19);
  - an empty label, or one `fieldRules.js` refuses, asks nothing, and the input shows the label the table holds again;
    so does one the node refuses.
- It repaints from the data set (goal/G41.14, Andy: *"EVERY FUCKING element MUST FUCKING LISTING to anything that
  changes their data set"*): when `data.bundles/<its id>` changes, as it sets it from the node's stream, its label
  repaints, the input with it; another bundle's row changes nothing.
- Delete is an `armingButton`; its second press asks `auth.bundle { op: 'delete', id }`.
- Edit requires `shell/js/branchEditor.js`, then opens it on this bundle: `branchEditor.open({ bundle: id, label })`.

- It takes the node's bundle rows from the stream itself, its kind's index (`shell/js/rowElement.js`, G30.18: the data type's code is its row element), into `data.bundles`: the node publishes each changed row of its two
  bundle tables on one permanent job of type `bundles`, `{ table, row }`, and `{ table, row: { id }, gone: true }`. A row
  published is kept by its id, published again replaces it, gone takes it out; the other table's rows, another job's, and
  a row with no id write nothing. It requires no data script.

## What its test must try to break

- A part counted on that the row did not load itself.
- A label or an owner drawn unescaped; an owner given an input.
- An empty or too long label sent to the node, or left in the input after a refusal.
- A Delete that asks on the first press.
- An Edit that opens the editor on another bundle, or without its label.
