# shell/grants/grants.js

The Grants app (apiAuth/G1.6; goal/G41.5; goal/G41.13; goal/G41.14): the owner's screen for who may call which api. Two tabs:
Grants, the add-grant row (grant a bundle to an ID) and below it every grant, each with its Revoke; and Bundles, where
bundles are made and kept. Intrinsic, so it shows on every face, the
loopback face's and a relay face's alike (Andy, Q1: "Of course on both, how else can i give someone access when i
travel?").

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api) })`.
- **It loads what it uses itself** (goal/G41.3), through `spirit.require`: `shell/js/probabilitySearch.js`,
  `shell/js/rowElement.js`, (goal/G41.9) `shell/js/armingButton.js`, and (goal/G41.13) `shell/js/tabContainer.js`,
  `shell/js/bundleSelector.js`, `shell/js/contactSelector.js` and `shell/js/bundleEditor.js`, and (goal/G41.14)
  `shell/js/apiFamilySelector.js`. It names `apiBranchSelector` no more: it was renamed `apiFamilySelector`, its verb
  half with it (Andy: *"apiFamiliySelector.js will use apiVerbSelector as part of itself"*). It takes them from
  `window.spirit.elements`, never from the old shell's `api.ui.elements`.
- **Nothing of `shellCreateListSearch`** is left in it (deprecated and forbidden on the face, goal/G40.8).
- **Two tabs** (goal/G41.13, box v7: "The grants app has two tabs: Grants, and Bundles"): the app is one
  `tabContainer` with the tabs `grants` and `bundles`, each with its label and mount. The Bundles tab is the bundle
  editor (`bundleEditor.create(box, { api })`), *"where bundles are created and maintained with the bundle shell
  element"*. The Grants tab holds the add-grant row and the list.
- **The grants list is a probabilitySearch pane** in a box of a stated size (`fill`, rule/16). Its columns are whose
  grant (`name`), the path (`path`) and `revoke`. Its rows are every grant `auth.search` answered with no words, held by
  the page, narrowed by the list's filters; none chosen means all.
- **Each row is a row element** (`rowElement.create`): it paints whose grant it is, the path, `deprecated` beside a path
  no server serves today (`apiTreeIndex.serves`; a report, never a prune), and its own Revoke, a row action
  (`data-action="revoke"`).
- **Revoke asks "are you sure?"** (goal/G41.9; Andy: "the revoke buttons must ask: \"are you sure?\""): each row's
  Revoke is an armingButton (`window.spirit.elements.armingButton`, by `attach` or `create`), loaded by the app itself
  through `spirit.require('shell/js/armingButton.js')` and handed the app's api. The first press arms it, the second
  runs it, a click elsewhere puts it back. Nothing of a hand-rolled confirm is in grants.js: no `data-armed`, no
  `armUntilElsewhere`, no `armed` class.
- **Revoke's run asks the node** (`auth.revoke` with the row's key and path) and reads no grant again: the row goes when
  the node's stream says so (rule/19).
- **The grant form, one row** (Andy, on G41.13: *"the grants tab should have one-row grant form: \"grant\" [idSelector]
  [bundleSelector] [grantButton]"*): "grant", the ID selector (`createContactSelector`), the bundle selector, then
  the Grant button, found by an id or data-action naming grant. There is no contacts list, and no server is asked for
  its DEPENDENCIES: every grant goes through a bundle.
- **The list's filters** (*"a probabilitySearch for grants. with the normal filters, (idSelector, apiBranchSelector,
  apiVerbSelector)"*), below the form: an ID selector of their own, and the family selector with its verb half. The ID
  narrows the list to that ID's grants; a family (`family`) to its paths; a verb (`verb`) to that verb. Nothing chosen
  shows every grant.
- **Revoke is the rightmost column** (*"the rows of the grant list show in the rightmost column a armingButton
  [Revoke]"*).
- **It loads every element it uses itself** (rule/26). Its test runs on a bare page: a stand-in is put there only
  once the app requires its file.
- **Grant copies the bundle's branches** (box v7: *"each path row of the bundle, combined with the ID chosen in the ID
  selector (contactSelector), becomes a new auth row, unless that row exists already"*; since goal/G41.14 a bundle's
  rows are its branches):
  - With no bundle or no ID chosen, Grant asks nothing.
  - It reads the chosen bundle's branches, `auth.branch { op: 'search', bundle }`, the bundle selector's value.
  - It asks `auth.grant { key, path }` once per branch, the key the ID chosen, the path `family.verb`, or the family
    alone for a branch of every verb (`(ALL)`).
  - A path the ID holds already (`already-granted`) is counted done, never said as a refusal. Any other refusal is
    said.
  - It reads no grant again: each new grant arrives on the node's stream, one row (rule/19).
  - A grant reaching a verb with a warning file asks first.

- **The list hears every grant change** (goal/G41.14, Andy: *"WHY DOES A GRANT NOT JUST SIMPLY UPDATE AN EXISTING
  FUCKING ROW?"*, *"SO THE MOTHERFUCKING GRANS TABLE DOES NOT BUPLISH EITHER????"*): the node publishes each grant row
  as it changes on the auth tables' job (type `bundles`, table `grant`), `{ row: { key, path, label } }`, and
  `{ row: { key, path }, gone: true }` when revoked. The grant row element takes it into `data.grants`, keyed
  `<key>\n<path>`; a bundle row or another job's writes nothing there. The list is a view of `data.grants`.

## What its test must try to break

- An old shell list made, or `api.ui.elements` reached.
- A component it uses not loaded by itself.
- A row without its Revoke, or a dead grant not marked deprecated (or a live one marked).
- A Revoke that changes the list without asking the node, or asks for the wrong key or path.
- A grant made from a bundle's old paths, or a branch of every verb granted as `family.`.
- A Revoke that revokes on a single press, or arms by hand instead of through armingButton.
- A chosen ID that does not narrow the list.
- A grant made of anything but a bundle's paths, or one path left out of it.
- An already-granted path reported as an error.
- The old line's api-branch selector, contacts list or Grant the bundle button left on the page.
