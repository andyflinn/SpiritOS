# bundleSelector.js

`spirit/run/shell/js/bundleSelector.js` is the bundle picker (goal/G41.13): *"A standard bundleSelector element picks
one bundle, beside the shell's other selectors."* Its test is `./bundleSelector.js`.

## Requirements

- It registers `spirit.elements.createBundleSelector(options)`, as `createContactSelector` is registered.
- It answers its root, class `bundle-selector`, with nothing chosen: `.value` is `''` and `.row` is `null`.
- It loads what it uses itself (rule/26: *"every shell element loads its own elements dynamically through the ...
  spirit.require functionality"*): on a bare page it requires `shell/js/probabilitySearch.js`, then builds on it, a
  dropdown by default, the list itself with `options.face: 'pane'`, searched as it is made. Its root is answered at
  once.
- Nothing of the old shell's list search is in it (goal/G40.8: forbidden on the face).
- Its rows are the node's bundles. A search asks `auth.bundle { op: 'search', text }` through the spirit object, and
  hands the list each bundle keyed by its id.
- A row shows the bundle's label, escaped.
- A pick sets `.value` to the bundle's id and `.row` to the bundle, its paths with it, and says so with one bubbling
  `change`. A clear picks nothing.
- `refresh()` asks again.

## What its test must try to break

- A selector that counts on an element the page did not load, or on the old list search. Its test runs on a bare
  page, every stand-in put there only once the selector requires it.
- A selector that asks anything but `auth.bundle`'s search.
- A pick that leaves out the bundle's paths, which the grants app grants from.
- A label drawn unescaped.
