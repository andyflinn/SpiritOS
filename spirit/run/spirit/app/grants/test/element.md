# spirit/app/grants/element.js

The Grants app (apiAuth/G1.6; goal/G41.5, G41.13, G41.14, G41.16, G41.32, G43.24): the owner's screen for who may call
which api. Intrinsic by its own `grants.json`, so it shows on every face, the loopback face's and a relay face's alike
(Andy, Q1: *"Of course on both, how else can i give someone access when i travel?"*). Its test is `./grants.js`; its
manifest, its tile and its opening in a real Chrome are judged in its wrapper part (below).

It is a wrapper (Andy: *"no i want those apps to basically be wrappers for spirit/element/ things...."*): its Grants tab is
the grants panel, which knows no table of its own; this app configures it (*"the callers (Grants and agent shell apps
should boody well know how to configure the damn grantsPanel element"*). The node's grants table, once this app's, is the
panel's `grantsPanel.nodeGrants` since goal/G43.24, and what the panel draws and does is the panel's
(`spirit/element/search/grant/test/grantsPanel.md`).

## Requirements

- **Mounted the new shell's way** (Andy: *"box that these apps must mount in the new format of the new shell."*), as
  `spirit/app/file/element.js` is: it sets `spirit.element.spirit.app.grants.element = { create(container, opts) -> { destroy() } }`. No
  `spirit.shell.activateApp`; nothing of the old shell (no `shellCreateListSearch`, no `api.ui.elements`, no
  `apiBranchSelector`).
- **A wrapper**: it loads `spirit/element/search/grant/grantsPanel.js`, `spirit/element/tabContainer.js` and
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

## The wrapper part: spirit/app/grants/element.js: Grants, a wrapper mounted the new shell's way

goal/G43.24, requirements 1 to 7, for Grants. Its test is the wrapper part of `./element.js`: the tree read as it is, `./element.js` run (its own checks, not this part again), then a real node on a scratch copy of the tree's files (tracked and new, not ignored) and real clicks in a real Chrome on `/face.html`, on the shell app (`spirit/app/app/element.js`) as boot.js draws it.

Andy: *"i just moved them, didn't fix the manifest."* (4f01465b: shell/info is spirit/app/info/, shell/grants is spirit/app/grants/), *"no i want those apps to basically be wrappers for spirit/element/ things...."*, and *"box that these apps must mount in the new format of the new shell."*

### Requirements

#### 1. The manifest

- `grants.json` holds what `file.json` holds, the spirit/app form: identity `{icon, label, intrinsic: true}`, mount `{"grants.js": true}`, shell `{true: false, mount: true, tile: true}`, node `{mount: false}`, and nothing of the old form.
- Icon and label as they were: Grants 🔒.
- Q1, the old description sentence: *"it goes."*

#### 2. Intrinsic by its own `grants.json`

- The node's `app.search` lists grants intrinsic, so always active. (Its leaving coreFiles.js's INTRINSIC list is `spirit/test/coreFiles.js`; the old shell's list, `spirit/client/test/shell-infoGrants.js`.)

#### 3. In the shell as before

- With nothing pressed, the shell shows its tile.
- Grants' tile opens Grants: its Grants and Bundles tabs, the grants panel configured (no "not configured"), one bar in view, `🔒 Grants`.

#### 4. Its test runs from the new place

- `spirit/app/grants/test/element.js` runs with no "Cannot find module" and prints testReport's completion line.

#### 5. Nothing names the old place

- No file of the tree (tracked, or new and not ignored) names `shell/grants`; the red files that must name it are left out.

#### 6. A wrapper of spirit/element/

- `grants.js` loads only `spirit/element/` scripts, through `spirit.require`; asks no cacheManager; calls no verb (`.verb(`, `spirit.outcome`, `callDialog`, `fetch`, relay.status, node.card, auth.search/grant/revoke); draws no markup of its own.
- (Grants' data source, in grantsPanel, is the authSource part of `spirit/element/search/grant/test/grantsPanel.js`.)

#### 7. The new shell's way

- No `spirit.shell.activateApp` in `grants.js`.
- On the page, `spirit.require('spirit/app/grants/element.js')` sets `spirit.element.spirit.app.grants.element`, whose `create(container, opts)` draws into the container and answers `{ destroy() }`.
