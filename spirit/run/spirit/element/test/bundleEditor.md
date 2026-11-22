# bundleEditor.js

`spirit/run/spirit/element/bundleEditor.js` is the panel that makes and keeps bundles (goal/G41.14): *"the \"bundleEditor\", a
simple panel-type shell element"*. The grants app draws it in its Bundles tab. Its test is `./bundleEditor.js`.

A bundle is a label (`auth.bundle`); what it reaches are its branches, edited in the branch editor that a row pressed
opens. So the editor names no description and no api-branch selector.

## Requirements

- **It adds node-owned bundles alone** (goal/G41.32; Andy: *"A user can only create, change and delete node-owned bundles and
  branches, and sees the others read-only"*, which overturns mounting it for an app server, goal/G41.25).

- It loads what it uses itself (rule/26): `spirit/element/fieldInput.js` and `spirit/element/search/bundle.js`, and the auth
  branch's interface (`spirit.require('spirit/auth/api.js')`, which brings its data.js; goal/G41.28), whose bundles it
  adds to; it requires no data.js itself.
- It registers `spirit.required.bundleEditor.create(container, opts)`, which answers `{ destroy }`. Drawn, it asks the
  node nothing.
- At the top, one row, a rowForm (goal/G41.27; Andy: *"bundleEditor:\n[➕] [label] [Add]"*): it loads
  `spirit/element/rowForm.js` itself and makes one rowForm in its own box (a `fill` box put into its container, overflow
  hidden, as the general rules ask of the box an element puts into its container), its icon ➕ and its button Add; its span holds the label
  input, a `fieldInput` held to the label's rule, and nothing else; the rowForm's button is the only Add; the word
  `new` at its start is gone.
- Add (Andy: *"the [add-Button] refused an empty or invalid label"*):
  - an empty label, or one the label's rule refuses, asks nothing;
  - a valid one asks `auth.bundle { op: 'add', label }`, the label as `fieldRules.normalize` writes it, and no owner:
    a user makes node-owned bundles alone;
  - **what it adds, it listens for** (goal/G41.28; Andy: *"EVERY FUCKING ELEMENT is verified to make sure when it
    changes shit it listens to fucking update via the spirit object"*): it watches `spirit.required.spirit.data.auth.data.bundles`; once the
    bundle it asked for is there, the input is emptied for the next and the add is said. Another bundle arriving
    leaves the label as it is. It asks its pane to search nothing again: the pane is a view of that branch;
  - refused, the node's words are said in the panel and the label stays in the input.
  - it is handed to the rowForm as `press` (goal/G47.1, Q20; Andy: *"mark the button busy from press until the mounter's answer
    comes"*): the press settles only once the node has answered, so Add is busy until then.
- Below it, filling the space left (a `fill` box, shell.css): the bundleSelector, `spirit.required.search.bundle.create(its own box, …)` (the shell's element
  shape, goal/G41.19), a pane, columns `label` and `owner` (goal/G41.25: the owner *"right after the bundles label"*), its labels shown only (goal/G41.26: *"the Label should now just be an output"*; no `editable`). What a row does is the row element's
  (`spirit/element/search/bundle/row.js`).
- `destroy()` empties its box, lets its watch on `spirit.required.spirit.data.auth.data.bundles` go and lets its bundle pane go.

## What its test must try to break

- An empty or too long label sent to the node.
- A label sent untrimmed.
- An input emptied, or the add said, before the bundle is in the auth family's cache, or left full once it is.
- A watch or a pane kept after destroy.
- A refusal kept silent.
- An add naming an owner.
- The old editor's description or api-branch selector left in it.
