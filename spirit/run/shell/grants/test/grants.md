# shell/grants/grants.js

The Grants app (apiAuth/G1.6; goal/G41.5): the owner's screen for who may call which api. One line (whose access, the
server, the verb, Grant) and below it every grant, each with its Revoke. Intrinsic, so it shows on every face, the
loopback face's and a relay face's alike (Andy, Q1: "Of course on both, how else can i give someone access when i
travel?").

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api) })`.
- **It loads what it uses itself** (goal/G41.3), through `spirit.require`: `shell/js/probabilitySearch.js`,
  `shell/js/rowElement.js`, `shell/js/contacts/listElement.js`, `shell/js/apiBranchSelector.js` and (goal/G41.9)
  `shell/js/armingButton.js`. It takes them from
  `window.spirit.elements`, never from the old shell's `api.ui.elements`.
- **Nothing of `shellCreateListSearch`** is left in it (deprecated and forbidden on the face, goal/G40.8).
- **The grants list is a probabilitySearch pane** in a box of a stated size (`fill`, rule/16). Its columns are whose
  grant (`name`), the path (`path`) and `revoke`. Its rows are every grant `auth.search` answered with no words, held by
  the page, narrowed by the line's choices: a chosen peer, server or verb narrows; one left unchosen means all.
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
- **The line**: whose access is the contacts list as a dropdown; the server and verb are the api-branch selector; Grant
  shows only once a contact and a server are chosen, else the line says which is missing; a server naming a bundle
  (`<server>.DEPENDENCIES`) offers Grant the bundle. A grant reaching a verb with a warning file asks first.

## What its test must try to break

- An old shell list made, or `api.ui.elements` reached.
- A component it uses not loaded by itself.
- A row without its Revoke, or a dead grant not marked deprecated (or a live one marked).
- A Revoke that changes the list without asking the node, or asks for the wrong key or path.
- A Revoke that revokes on a single press, or arms by hand instead of through armingButton.
- A chosen peer that does not narrow the list.
