# spirit/app/grants/grants.js

The Grants app (apiAuth/G1.6; goal/G41.5, G41.13, G41.14, G41.16, G41.32, G43.24): the owner's screen for who may call
which api. Intrinsic by its own `grants.json`, so it shows on every face, the loopback face's and a relay face's alike
(Andy, Q1: *"Of course on both, how else can i give someone access when i travel?"*). Its test is `./grants.js`; its
manifest, its tile and its opening in a real Chrome are judged in `spirit/app/test/infoGrants.js`.

It is a wrapper (Andy: *"no i want those apps to basically be wrappers for spirit/element/ things...."*): its Grants tab is
the grants panel, which knows no table of its own; this app configures it (*"the callers (Grants and agent shell apps
should boody well know how to configure the damn grantsPanel element"*). The node's grants table, once this app's, is the
panel's `grantsPanel.nodeGrants` since goal/G43.24, and what the panel draws and does is the panel's
(`spirit/element/test/grantsPanel.md`).

## Requirements

- **Mounted the new shell's way** (Andy: *"box that these apps must mount in the new format of the new shell."*), as
  `spirit/app/file/file.js` is: it sets `spirit.elements.grants = { create(container, opts) -> { destroy() } }`. No
  `spirit.shell.activateApp`; nothing of the old shell (no `shellCreateListSearch`, no `api.ui.elements`, no
  `apiBranchSelector`).
- **A wrapper**: it loads `spirit/element/grantsPanel.js`, `spirit/element/tabContainer.js` and
  `spirit/element/bundleEditor.js` through `spirit.require` (rule/26), and nothing else. It asks nothing itself (no verb,
  no api, no auth verb, no cache of its own) and draws nothing itself (no markup, no list, no selector).
- `create(container)` empties the container and makes one `tabContainer` in it with two tabs: `grants` (*Grants*), then
  `bundles` (*Bundles*).
  - The Grants tab is the grants panel, made in the tab's box: `ids` the contacts' table,
    `loopback://api/contact/search`; `grants` the node's own, `grantsPanel.nodeGrants`; nothing else, no api.
  - The Bundles tab is the bundle editor, made in the tab's box, handed this app's own tabContainer to open each
    bundle's tab in (Andy: *"in the Grants app, this will be the grant app's tabContainer."*) and a `tabLabel` naming each
    tab owner-bundle, `node` when no owner is said (Andy: *"Grants: <owner>-<bundle>."*); nothing else, no api.
- An element refused, the container says *Grants could not be loaded.*
- `destroy()` destroys the tabs and empties the container; destroyed before its elements load, nothing is made.

## goal/G41.32, in a real browser on a scratch node

On a scratch copy of the tree's files, the Grants app opened from its tile in the shell app on `/face.html`, the box's
bundle lines judged by real clicks: no Edit or Delete in the pane; a row pressed opens a closable tab in the app's own tab
row, named owner-bundle (Andy: *"the tabs should name owner-bundle"*), its close button small and on the tab's right; the
same row again makes that tab active; the close button takes the tab away and the bundle stays. The branchEditor has a
rowForm below the others: ❌, *"Delete <bundle-name> bundle and branches"*, an arming button: one press only arms, the
second deletes and the tab closes. A bundle deleted at the door closes its tab. A server's bundle opens read-only, with no
form and no Delete, and the node refuses its delete. With no tabContainer configured, as in the agent app for now, the
pane has no Edit or Delete, and a press throws nothing.

## What its test must try to break

- Anything the app asks, keeps or draws itself.
- A Grants tab that is not the panel, a panel handed another ID table or grants table, or an api handed.
- A Bundles tab whose tabs open elsewhere than this app's tab row, or are named otherwise than owner-bundle.
- A mount through the old shell; something made after destroy.
