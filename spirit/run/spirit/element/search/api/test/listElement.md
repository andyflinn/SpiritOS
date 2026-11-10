# spirit/element/search/api/listElement.js, the family list

The app-server selector (apiAuth/G1.8; goal/G41.5): a dropdown of the families a party's api tree lists. Grants and
introspector build their lines with it, through the family selector, `../api.js`. It stood in that file until goal/G43.32;
since, it is the api search's list (Andy: *"uniformity, in the search elements and their folders, contain list, row an
detail elements."*), each row `./rowElement.js`, and in a pane a pressed row opens `./detailElement.js` under it. Its
test is `./listElement.js`.

## Requirements

- **Built on probabilitySearch**, as a dropdown (`face: 'dropdown'`); nothing of `shellCreateListSearch` (goal/G40.8).
- **It loads probabilitySearch itself**, through `spirit.require` (goal/G41.3).
- `spirit.element.spirit.element.search.api.listElement.create(container, { face, placeholder, all, tree })` appends its root element to the container and
  answers it (box v23: *"every element gets a container and appends itself"*); `createAppServerSelector` no more.
  `root.value` the chosen family, `''` for none; `root.tree` the tree it was drawn from.
- Its rows are `apiTreeIndex.servers(tree)`: sorted, a family that did not answer (`{ ok: false }`) left out.
- `all` is what its None reads; None clears the value.
- A pick sets `root.value` and fires a bubbling `change`.
- **Any party's tree** (goal/G30.5): `options.tree` or `root.load(fn)` lists the families of the tree `fn` answers and
  clears the choice; without one, this node's own (`spirit.ready` then `tree()`). `root.load(fn)` on a selector made for this node
  is deferred with introSpector and still red (the box: *"the only exception is introspector, deferred for network-scope
  design reasons."*): its red says so.

## What its test must try to break

- An old shell list made, or probabilitySearch not loaded by itself.
- The old factory still registered, or a control not appended to its container.
- A family that did not answer listed, or the rows unsorted.
- A pick that does not fire change, or None that leaves the value.
- load(fn) still listing the old tree.
