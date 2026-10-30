# branchSelector.js

`spirit/run/shell/js/branchSelector.js` is the branch selector (goal/G41.14): a thin selector over its own list,
`shell/js/branchSelector/listElement.js`, as `bundleSelector.js` is over the bundles. Its test is `./branchSelector.js`.

Andy, box: *"branchSelector.js and branchSelector/ folder, featuring a pane mode and a dropdown mode for displaying and
selecting branch rows."*

## Requirements

- It registers `spirit.elements.branchSelector.create(container, options)`, and `createBranchSelector` no more. Its root is
  appended to the container and answered (box v23: *"every element gets a container and appends itself"*).
- It answers its root at once, class `branch-selector`, with nothing chosen: `.value` is `''` and `.row` is `null`.
- It loads what it uses itself (rule/26): on a bare page it requires `shell/js/branchSelector/listElement.js` and draws
  that list into its root. Nothing of the old shell's list search is in it (goal/G40.8).
- A dropdown by default; `options.face: 'pane'` is the list itself. `bundle`, `placeholder` and `columns` are handed to
  the list.
- A pick sets `.value` to the branch's id, a number, and `.row` to the branch `{ id, bundle, family, verb }`, and says
  so with one bubbling `change`. A clear picks nothing.
- `refresh()` asks again.

## What its test must try to break

- The old factory still registered, or a root not appended to its container.
- A selector that counts on an element the page did not load, or on the old list search.
- A list that is not told its bundle.
- A pick that leaves `.value` a text, or `.row` without the branch.
