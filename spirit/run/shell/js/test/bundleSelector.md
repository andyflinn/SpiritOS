# bundleSelector.js

`spirit/run/shell/js/bundleSelector.js` is the bundle selector (goal/G41.14): a thin selector over its own list,
`shell/js/bundleSelector/listElement.js`, as `contactSelector.js` is over the contacts. Its test is `./bundleSelector.js`.

Andy, box: *"bundleSelector.js and bundleSelector/ folder, featuring a pane mode and a dropdown mode for displaying and
selecting bundle rows."*

## Requirements

- It registers `spirit.elements.bundleSelector.create(container, options)`, and `createBundleSelector` no more. Its root is
  appended to the container and answered (box v23: *"every element gets a container and appends itself"*).
- It answers its root at once, class `bundle-selector`, with nothing chosen: `.value` is `''` and `.row` is `null`.
- It loads what it uses itself (rule/26): on a bare page it requires `shell/js/bundleSelector/listElement.js` and draws
  that list into its root. Nothing of the old shell's list search is in it (goal/G40.8).
- A dropdown by default; `options.face: 'pane'` is the list itself. `placeholder`, `columns` and `editable` are handed
  to the list.
- A pick sets `.value` to the bundle's id, a number, and `.row` to the bundle `{ id, label }`, and says so with one
  bubbling `change`. A clear picks nothing.
- `refresh()` asks again.
- **Mounted for an app server** (goal/G41.25). Andy, box: *"the bundleSelector can be optionally configured with an
  <AppServerName> (family) at mount-time"*. `options.family` is handed to its list, which lists that server's bundles
  alone; without it, no family, and every bundle.

## What its test must try to break

- The old factory still registered, or a root not appended to its container.
- A selector that counts on an element the page did not load, or on the old list search.
- A pick that leaves `.value` a text, or `.row` without the bundle.
- A pane that loses the editor's columns or its editing.
- A family not handed to the list, or one handed when none was asked.
