# Info and Grants in spirit/app/

goal/G43.24, requirements 1 to 7. Its test is `./api-infoGrants.js`: the tree read as it is, the two moved tests run, then a real node on a scratch copy of the tree's files (tracked and new, not ignored) and real clicks in a real Chrome on `/face.html`, on the shell app (`spirit/app/shell/shell.js`) as boot.js draws it. Requirement 8, the rotate key dialog, is judged by `spirit/element/test/nodeInfo-rotate.js`.

Andy: *"i just moved them, didn't fix the manifest."* (4f01465b: shell/info is spirit/app/info/, shell/grants is spirit/app/grants/), *"no i want those apps to basically be wrappers for spirit/element/ things...."*, and *"box that these apps must mount in the new format of the new shell."*

## Requirements

### 1. The manifests

- `info.json` and `grants.json` hold what `file.json` holds, the spirit/app form: identity `{icon, label, intrinsic: true}`, mount `{"<name>.js": true}`, shell `{true: false, mount: true, tile: true}`, node `{mount: false}`, and nothing of the old form.
- Icon and label as they were: Info ℹ️, Grants 🔒.
- Q1, the old description sentence: *"it goes."*

### 2. Intrinsic by their own `<name>.json`

- `shell/info` and `shell/grants` leave coreFiles.js's INTRINSIC list; `info` and `grants` are not in the old shell's INTRINSIC_APP_FOLDERS (`spirit/client/shell.js`).
- `coreFiles.appIntrinsic` reads each intrinsic from its own json, and the node's `app.search` lists each intrinsic, so always active.

### 3. In the shell as before

- With nothing pressed, the shell shows a tile each.
- Info's tile opens Info: its name and description fields (`data-field` label and description) and its Rotate this node's cipher key button, nothing "could not be loaded", one bar in view, `ℹ️ Info`.
- Grants' tile opens Grants: its Grants and Bundles tabs, the grants panel configured (no "not configured"), one bar in view, `🔒 Grants`.

### 4. Their tests run from the new place

- `spirit/app/info/test/info.js` and `spirit/app/grants/test/grants.js` run with no "Cannot find module" and print testReport's completion line.

### 5. Nothing names the old places

- No file of the tree (tracked, or new and not ignored) names `shell/info` or `shell/grants`; this item's own red files are left out, since they must name them.

### 6. Wrappers of spirit/element/

- Each `<name>.js` loads only `spirit/element/` scripts, through `spirit.require`; asks no cacheManager; calls no verb (`.verb(`, `spirit.outcome`, `callDialog`, `fetch`, relay.status, node.card, auth.search/grant/revoke); draws no markup of its own.
- Grants' data source moves into grantsPanel: `grantsPanel.js` asks auth.search, auth.grant and auth.revoke, over the auth cache.
- Info's own parts move into `spirit/element/nodeInfo.js` (Q2: *"nodeInfo is fine."*): info.js loads it; it asks relay.status and node.card and draws the rotate button.

### 7. The new shell's way

- No `spirit.shell.activateApp` in either `<name>.js`.
- On the page, `spirit.require('spirit/app/<name>/<name>.js')` sets `spirit.elements.<name>`, whose `create(container, opts)` draws into the container and answers `{ destroy() }`.
