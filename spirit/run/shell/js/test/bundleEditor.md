# bundleEditor.js

`spirit/run/shell/js/bundleEditor.js` is the panel that makes and keeps bundles (goal/G41.14): *"the \"bundleEditor\", a
simple panel-type shell element"*. The grants app draws it in its Bundles tab. Its test is `./bundleEditor.js`.

A bundle is a label (`auth.bundle`); what it reaches are its branches, edited in the branch editor that a row's Edit
opens. So the editor names no description and no api-branch selector.

## Requirements

- **Mounted for an app server** (goal/G41.25). Andy, box: *"the bundle-editor can be optionally configured with an
  <AppServerName> (family) at mount-time"*, and *"when a bundle is added the \"owner\" field will ALWAYS be set to
  \"node\", unless the bundleEditor was mounted for an appServer, then the owner field sill be set to <AppServerName>"*.
  `create(container, { family })`: every add names that family as its owner; without it, `node`.

- It loads what it uses itself (rule/26): `shell/js/fieldInput.js` and `shell/js/bundleSelector.js`.
- It registers `spirit.elements.bundleEditor.create(container, opts)`, which answers `{ destroy }`. Drawn, it asks the
  node nothing.
- At the top, one row (Andy: *"top: a one-row add form: \"new\" [fieldInput.js/fieldRules:Label input field]
  [Add-Button]"*): it reads `new`, then a label input, a `fieldInput` held to the label's rule, then an Add button.
- Add (Andy: *"the [add-Button] refused an empty or invalid label"*):
  - an empty label, or one the label's rule refuses, asks nothing;
  - a valid one asks `auth.bundle { op: 'add', label, owner }`, the label as `fieldRules.normalize` writes it, the
    owner `node`, or the app server it was mounted for (below);
  - answered, the list searches again and the input is emptied for the next;
  - refused, the node's words are said in the panel and the label stays in the input.
- Below it, filling the space left (a `fill` box, shell.css): `bundleSelector.create(its box, …)` (the shell's element
  shape, goal/G41.19), a pane, columns `label`, `owner`, `edit` and `delete` (goal/G41.25: the owner *"right after the bundles label"*), its labels edited in place (`editable`). What a row does is the row element's
  (`shell/js/bundleSelector/rowElement.js`).
- `destroy()` empties its box.

## What its test must try to break

- An empty or too long label sent to the node.
- A label sent untrimmed.
- A list that does not search again after an add, or an input left full.
- A refusal kept silent.
- An add with no owner, or another owner than the one it was mounted for.
- The old editor's description or api-branch selector left in it.
