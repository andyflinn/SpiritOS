# spirit/app/grants/grants.js: Grants, a wrapper mounted the new shell's way

goal/G43.24, requirements 1 to 7, for Grants. Its test is `./grants-wrapper.js`: the tree read as it is, `./grants.js` run, then a real node on a scratch copy of the tree's files (tracked and new, not ignored) and real clicks in a real Chrome on `/face.html`, on the shell app (`spirit/app/shell/shell.js`) as boot.js draws it.

Andy: *"i just moved them, didn't fix the manifest."* (4f01465b: shell/info is spirit/app/info/, shell/grants is spirit/app/grants/), *"no i want those apps to basically be wrappers for spirit/element/ things...."*, and *"box that these apps must mount in the new format of the new shell."*

## Requirements

### 1. The manifest

- `grants.json` holds what `file.json` holds, the spirit/app form: identity `{icon, label, intrinsic: true}`, mount `{"grants.js": true}`, shell `{true: false, mount: true, tile: true}`, node `{mount: false}`, and nothing of the old form.
- Icon and label as they were: Grants 🔒.
- Q1, the old description sentence: *"it goes."*

### 2. Intrinsic by its own `grants.json`

- The node's `app.search` lists grants intrinsic, so always active. (Its leaving coreFiles.js's INTRINSIC list is `spirit/test/coreFiles-infoGrants.js`; the old shell's list, `spirit/client/test/shell-infoGrants.js`.)

### 3. In the shell as before

- With nothing pressed, the shell shows its tile.
- Grants' tile opens Grants: its Grants and Bundles tabs, the grants panel configured (no "not configured"), one bar in view, `🔒 Grants`.

### 4. Its test runs from the new place

- `spirit/app/grants/test/grants.js` runs with no "Cannot find module" and prints testReport's completion line.

### 5. Nothing names the old place

- No file of the tree (tracked, or new and not ignored) names `shell/grants`; the red files that must name it are left out.

### 6. A wrapper of spirit/element/

- `grants.js` loads only `spirit/element/` scripts, through `spirit.require`; asks no cacheManager; calls no verb (`.verb(`, `spirit.outcome`, `callDialog`, `fetch`, relay.status, node.card, auth.search/grant/revoke); draws no markup of its own.
- (Grants' data source, in grantsPanel, is `spirit/element/test/grantsPanel-authSource.js`.)

### 7. The new shell's way

- No `spirit.shell.activateApp` in `grants.js`.
- On the page, `spirit.require('spirit/app/grants/grants.js')` sets `spirit.elements.grants`, whose `create(container, opts)` draws into the container and answers `{ destroy() }`.
