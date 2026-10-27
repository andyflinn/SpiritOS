# shell/js/appServerSelector.js

The app-server selector (apiAuth/G1.8; goal/G41.5): one shell element, a dropdown of the families a party's api tree
lists. Grants and introSpector build their lines with it, through the api-branch selector.

## Requirements

- **Built on probabilitySearch**, as a dropdown (`face: 'dropdown'`); nothing of `shellCreateListSearch` (goal/G40.8).
- **It loads probabilitySearch itself**, through `spirit.require` (goal/G41.3).
- `createAppServerSelector({ placeholder, all, tree })` answers its root element: `root.value` the chosen family, `''`
  for none; `root.tree` the tree it was drawn from.
- Its rows are `apiTreeIndex.servers(tree)`: sorted, a family that did not answer (`{ ok: false }`) left out.
- `all` is what its None reads; None clears the value.
- A pick sets `root.value` and fires a bubbling `change`.
- **Any party's tree** (goal/G30.5): `options.tree` or `root.load(fn)` lists the families of the tree `fn` answers and
  clears the choice; without one, this node's own (`spirit.ready` then `tree()`).

## What its test must try to break

- An old shell list made, or probabilitySearch not loaded by itself.
- A family that did not answer listed, or the rows unsorted.
- A pick that does not fire change, or None that leaves the value.
- load(fn) still listing the old tree.
