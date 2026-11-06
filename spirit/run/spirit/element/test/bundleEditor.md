# bundleEditor.js

`spirit/run/spirit/element/bundleEditor.js` is the panel that makes and keeps bundles (goal/G41.14): *"the \"bundleEditor\", a
simple panel-type shell element"*. The grants app draws it in its Bundles tab. Its test is `./bundleEditor.js`.

A bundle is a label (`auth.bundle`); what it reaches are its branches, edited in the branch editor that a row pressed
opens. So the editor names no description and no api-branch selector.

## Requirements

- **It adds node-owned bundles alone** (goal/G41.32; Andy: *"A user can only create, change and delete node-owned bundles and
  branches, and sees the others read-only"*, which overturns mounting it for an app server, goal/G41.25).

- It loads what it uses itself (rule/26): `spirit/element/fieldInput.js` and `spirit/element/search/bundle.js`, and the auth
  family's cache manager (`spirit.cacheManager('auth')`, goal/G41.28), whose bundles it adds to.
- It registers `spirit.element.bundleEditor.create(container, opts)`, which answers `{ destroy }`. Drawn, it asks the
  node nothing.
- At the top, one row, a rowForm (goal/G41.27; Andy: *"bundleEditor:\n[➕] [label] [Add]"*): it loads
  `spirit/element/rowForm.js` itself and makes one rowForm in its box, its icon ➕ and its button Add; its span holds the label
  input, a `fieldInput` held to the label's rule, and nothing else; the rowForm's button is the only Add; the word
  `new` at its start is gone.
- Add (Andy: *"the [add-Button] refused an empty or invalid label"*):
  - an empty label, or one the label's rule refuses, asks nothing;
  - a valid one asks `auth.bundle { op: 'add', label }`, the label as `fieldRules.normalize` writes it, the
    a user making node-owned bundles alone;
  - **what it adds, it listens for** (goal/G41.28; Andy: *"EVERY FUCKING ELEMENT is verified to make sure when it
    changes shit it listens to fucking update via the spirit object"*): it watches `spirit.data.auth.data.bundles`; once the
    bundle it asked for is there, the input is emptied for the next and the add is said. Another bundle arriving
    leaves the label as it is. It asks its pane to search nothing again: the pane is a view of that branch;
  - refused, the node's words are said in the panel and the label stays in the input.
- Below it, filling the space left (a `fill` box, shell.css): `bundleSelector.create(its box, …)` (the shell's element
  shape, goal/G41.19), a pane, columns `label` and `owner` (goal/G41.25: the owner *"right after the bundles label"*), its labels shown only (goal/G41.26: *"the Label should now just be an output"*; no `editable`). What a row does is the row element's
  (`spirit/element/search/bundle/rowElement.js`).
- `destroy()` empties its box, lets its watch on `spirit.data.auth.data.bundles` go and lets its bundle pane go.

## What its test must try to break

- An empty or too long label sent to the node.
- A label sent untrimmed.
- An input emptied, or the add said, before the bundle is in the auth family's cache, or left full once it is.
- A watch or a pane kept after destroy.
- A refusal kept silent.
- An add naming an owner.
- The old editor's description or api-branch selector left in it.
