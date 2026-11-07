# spirit/element/search/bundle/rowElement.js

`spirit/run/spirit/element/search/bundle/rowElement.js` is one bundle as a row element (goal/G41.14), as
`spirit/element/search/contact/rowElement.js` is one contact. The bundle list draws its rows with it. Its test is
`./rowElement.js`.

Andy, box: *"these shell elements must follow the design pattern of the contactSelector, with a sibling folder for a
listElement.js and a rowElement.js script to fit within the probabilitySearch framework."*

## Requirements

- It loads what it uses itself (rule/26): `spirit/element/rowElement.js`, through `spirit.require`; no arming button
  (Delete is the branchEditor's, goal/G41.32).
- It registers `spirit.element.search.bundle.rowElement.create(row)`: a row element (`spirit/element/rowElement.js`) of kind
  `bundle`, keyed by the bundle's id. Its row is the bundle as `auth.bundle` answers it, `{ id, label, owner }`.
- Its fields are `label` and `owner`, in that order (goal/G41.25: the owner *"displayed right after
  the bundles label"*). The owner is drawn escaped, as the bundle names it, and never as an input: *"the owner field
  can never be changed after a bundle is added"*. The label is drawn escaped.
- **The label is shown only** (goal/G41.26, Andy: *"bundleSelector:pane mode the Label should now just be an output,
  field: A bundles label is determined when it's added, and cannot be modified. This will protect family owned bundles
  from having their label mutilated."*): mounted, with the old `editable` option or without it, the label cell shows the
  label, escaped, and holds no input; the row asks the node no set, ever (there is none, `../../../../test/apiAuth.md`).
- It repaints from the data set (goal/G41.14, Andy: *"EVERY FUCKING element MUST FUCKING LISTING to anything that
  changes their data set"*): when its row in the auth family's bundles (`spirit.data.auth.data.bundles.row(<its id>)`;
  goal/G41.28, `<node>/auth/bundles/<id>` in `spirit.data`) changes, as the node's stream sets it, its label
  repaints; another bundle's row changes nothing.
- No Edit and no Delete (goal/G41.32): a row pressed is the selector's, Delete is the branchEditor's.

- The node's bundle rows are taken from the stream by the auth family's cache manager
  (`spirit/run/spirit/auth/data.js`, goal/G41.28), which the row element loads itself
  (`spirit.cacheManager('auth')`; G41.14 until then, its own translation), into `spirit.data.auth.data.bundles`: the node publishes each changed row of its two
  bundle tables on one permanent job of type `bundles`, `{ table, row }`, and `{ table, row: { id }, gone: true }`. A row
  published is kept by its id, published again replaces it, gone takes it out; the other table's rows, another job's, and
  a row with no id write nothing. It requires no data script.

## What its test must try to break

- A part counted on that the row did not load itself.
- A label or an owner drawn unescaped; an owner given an input.
- A label given an input, or a set asked of the node.
- An Edit or a Delete drawn on the row.
