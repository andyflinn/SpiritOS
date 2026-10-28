# shell/grants/grants.js

The Grants app (apiAuth/G1.6; goal/G41.5; goal/G41.13): the owner's screen for who may call which api. Two tabs:
Grants, the add-grant row (grant a bundle to an ID) and below it every grant, each with its Revoke; and Bundles, where
bundles are made and kept. Intrinsic, so it shows on every face, the
loopback face's and a relay face's alike (Andy, Q1: "Of course on both, how else can i give someone access when i
travel?").

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api) })`.
- **It loads what it uses itself** (goal/G41.3), through `spirit.require`: `shell/js/probabilitySearch.js`,
  `shell/js/rowElement.js`, (goal/G41.9) `shell/js/armingButton.js`, and (goal/G41.13) `shell/js/tabContainer.js`,
  `shell/js/bundleSelector.js`, `shell/js/contactSelector.js` and `shell/js/bundleEditor.js`. It takes them from
  `window.spirit.elements`, never from the old shell's `api.ui.elements`.
- **Nothing of `shellCreateListSearch`** is left in it (deprecated and forbidden on the face, goal/G40.8).
- **Two tabs** (goal/G41.13, box v7: "The grants app has two tabs: Grants, and Bundles"): the app is one
  `tabContainer` with the tabs `grants` and `bundles`, each with its label and mount. The Bundles tab is the bundle
  editor (`bundleEditor.create(box, { api })`), *"where bundles are created and maintained with the bundle shell
  element"*. The Grants tab holds the add-grant row and the list.
- **The grants list is a probabilitySearch pane** in a box of a stated size (`fill`, rule/16). Its columns are whose
  grant (`name`), the path (`path`) and `revoke`. Its rows are every grant `auth.search` answered with no words, held by
  the page, narrowed by the ID chosen in the add-grant row; none chosen means all.
- **Each row is a row element** (`rowElement.create`): it paints whose grant it is, the path, `deprecated` beside a path
  no server serves today (`apiTreeIndex.serves`; a report, never a prune), and its own Revoke, a row action
  (`data-action="revoke"`).
- **Revoke asks "are you sure?"** (goal/G41.9; Andy: "the revoke buttons must ask: \"are you sure?\""): each row's
  Revoke is an armingButton (`window.spirit.elements.armingButton`, by `attach` or `create`), loaded by the app itself
  through `spirit.require('shell/js/armingButton.js')` and handed the app's api. The first press arms it, the second
  runs it, a click elsewhere puts it back. Nothing of a hand-rolled confirm is in grants.js: no `data-armed`, no
  `armUntilElsewhere`, no `armed` class.
- **Revoke's run asks the node** (`auth.revoke` with the row's key and path) and then reads the grants again: what the list
  shows is only what the node answered (rule/19).
- **The add-grant row** (goal/G41.13, box v7: *"\"grant\" [bundleSelector] \"to\" [configurable ID selector]"*): it
  reads "grant" [the bundle selector] "to" [the ID selector, `createContactSelector`], then a Grant button, found by
  an id or data-action naming grant. There is no api-branch selector and no contacts list on it, and no server is asked
  for its DEPENDENCIES: every grant goes through a bundle. What is configured on the ID selector waits on Q2.
- **Grant copies the bundle's paths** (box v7: *"each path row of the bundle, combined with the ID chosen in the ID
  selector (contactSelector), becomes a new auth row, unless that row exists already"*):
  - With no bundle or no ID chosen, Grant asks nothing.
  - It asks `auth.grant { key, path }` once for each path of the chosen bundle, the key the ID chosen.
  - A path the ID holds already (`already-granted`) is counted done, never said as a refusal. Any other refusal is
    said.
  - Then it reads the grants again, drawing only what the node answers (rule/19).
  - A grant reaching a verb with a warning file asks first.

## What its test must try to break

- An old shell list made, or `api.ui.elements` reached.
- A component it uses not loaded by itself.
- A row without its Revoke, or a dead grant not marked deprecated (or a live one marked).
- A Revoke that changes the list without asking the node, or asks for the wrong key or path.
- A Revoke that revokes on a single press, or arms by hand instead of through armingButton.
- A chosen ID that does not narrow the list.
- A grant made of anything but a bundle's paths, or one path left out of it.
- An already-granted path reported as an error.
- The old line's api-branch selector, contacts list or Grant the bundle button left on the page.
