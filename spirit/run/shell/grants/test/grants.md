# shell/grants/grants.js

The Grants app (apiAuth/G1.6; goal/G41.5, goal/G41.13, goal/G41.14): the owner's screen for who may call which api. Two
tabs: Grants, the grant form and below it every grant; and Bundles, where bundles are made and kept. Intrinsic, so it
shows on every face, the loopback face's and a relay face's alike (Andy, Q1: "Of course on both, how else can i give
someone access when i travel?"). Its test is `./grants.js`.

The grant list and the grant row are elements of their own since goal/G41.14 (Andy: *"INCLUDING COMPLETE TEST FOLDER FOR
THE COMPONENTS INVOLVED!!!!"*): `shell/js/grantSelector/listElement.js` and `rowElement.js`, each with its test folder.
How a grant row looks, its Revoke, and how the list hears the node's stream are theirs; this spec is what the app does
with them.

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api) })`.
- **Nothing of the old shell**: no `shellCreateListSearch` (goal/G40.8), no `api.ui.elements`, no `apiBranchSelector`
  (renamed `apiFamilySelector`, goal/G41.14).
- **It loads what it uses itself** (rule/26), on a bare page: `shell/js/grantSelector/listElement.js`,
  `shell/js/tabContainer.js`, `shell/js/bundleSelector.js`, `shell/js/contactSelector.js`, `shell/js/bundleEditor.js` and
  `shell/js/apiFamilySelector.js`. It keeps no grant list or row element of its own, and loads no data script.
- **Two tabs** (goal/G41.13, box v7): one `tabContainer`, tabs `grants` and `bundles`, each with its label and mount. The
  Bundles tab is the bundle editor, in its own box, with the app's api.
- **The grant form, one row** (Andy: *"the grants tab should have one-row grant form: \"grant\" [idSelector]
  [bundleSelector] [grantButton]"*): "grant", an ID selector (`createContactSelector`), the bundle selector, then the
  Grant button, found by an id or data-action naming grant.
- **The list's filters, below the form** (*"a probabilitySearch for grants. with the normal filters"*): an ID selector of
  their own and the family selector with its verb half. The app hands the grant list its filters: nothing chosen, every
  grant passes; the ID narrows to that ID's grants; a family to its paths; a verb to that verb. A change redraws the
  list.
- **The list is the grant list element, in the one box that fills** (rule/16; Andy: *"and what about the HUGE vertical
  space in the grants tab, between the search filters and the search input???"*): the list's host is a `fill` box, and
  nothing above it fills: the heading, the form and the filters take their own height, the list the rest.
- **Deprecated is a report** (Andy, apiAuth/G1.6: *"so we defer pruning to be triggered by the owners auth app, who can
  report deprecated branches"*): the app reads the api tree through the spirit object, `spirit.tree()`, and tells the list
  what it serves (`serves(path)`): a path whose family no server on this node serves today reads deprecated. Nothing is
  pruned by it.
- **Grant copies the bundle's branches** (box v7: *"each path row of the bundle, combined with the ID chosen in the ID
  selector (contactSelector), becomes a new auth row, unless that row exists already"*; since goal/G41.14 a bundle's rows
  are its branches):
  - with no bundle or no ID chosen, Grant asks nothing;
  - it reads the chosen bundle's branches, `auth.branch { op: 'search', bundle }`;
  - it asks `auth.grant { key, path }` once per branch, the key the ID chosen, the path `family.verb`, or the family
    alone for a branch of every verb;
  - a path the ID holds already (`already-granted`) is counted done, never said as a refusal; any other refusal is said;
  - it reads no grant again: each new grant arrives on the node's stream, one row (rule/19).

## What its test must try to break

- An old shell list, `api.ui.elements` or `apiBranchSelector` left in it.
- A component it uses not loaded by itself; a grant list or row of its own; a data script.
- The form out of order, or the filters above it.
- A filter that does not narrow, or a change that does not redraw the list.
- A fill box above the list, or the list's host not one.
- A tree read anywhere but `spirit.tree()`; a served path reported deprecated, or an unserved one not.
- A grant made of anything but the bundle's branches, or one branch left out of it; an already-granted path reported as
  an error; a grant change that reads every grant again.
