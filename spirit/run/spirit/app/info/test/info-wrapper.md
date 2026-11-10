# spirit/app/info/info.js: Info, a wrapper mounted the new shell's way

goal/G43.24, requirements 1 to 7, for Info. Its test is `./info-wrapper.js`: the tree read as it is, `./info.js` run, then a real node on a scratch copy of the tree's files (tracked and new, not ignored) and real clicks in a real Chrome on `/face.html`, on the shell app (`spirit/app/shell/shell.js`) as boot.js draws it.

Andy: *"i just moved them, didn't fix the manifest."* (4f01465b: shell/info is spirit/app/info/, shell/grants is spirit/app/grants/), *"no i want those apps to basically be wrappers for spirit/element/ things...."*, and *"box that these apps must mount in the new format of the new shell."*

## Requirements

### 1. The manifest

- `info.json` holds what `file.json` holds, the spirit/app form: identity `{icon, label, intrinsic: true}`, mount `{"info.js": true}`, shell `{true: false, mount: true, tile: true}`, node `{mount: false}`, and nothing of the old form.
- Icon and label as they were: Info ℹ️.
- Q1, the old description sentence: *"it goes."*

### 2. Intrinsic by its own `info.json`

- The node's `app.search` lists info intrinsic, so always active. (Its leaving coreFiles.js's INTRINSIC list is `spirit/test/coreFiles-infoGrants.js`; the old shell's list, `spirit/client/test/shell-infoGrants.js`.)

### 3. In the shell as before

- With nothing pressed, the shell shows its tile.
- Info's tile opens Info: its name and description fields (`data-field` label and description) and its Rotate this node's cipher key button, nothing "could not be loaded", one bar in view, `ℹ️ Info`; its ✕ shows the tiles again.

### 4. Its test runs from the new place

- `spirit/app/info/test/info.js` runs with no "Cannot find module" and prints testReport's completion line.

### 5. Nothing names the old place

- No file of the tree (tracked, or new and not ignored) names `shell/info`; the red files that must name it are left out.

### 6. A wrapper of spirit/element/

- `info.js` loads only `spirit/element/` scripts, through `spirit.require`; asks no cacheManager; calls no verb (`.verb(`, `spirit.outcome`, `callDialog`, `fetch`, relay.status, node.card, auth.search/grant/revoke); draws no markup of its own.
- Info's own parts move into `spirit/element/nodeInfo.js` (Q2: *"nodeInfo is fine."*): info.js loads it. (What nodeInfo asks and draws is `spirit/element/test/nodeInfo-parts.js`.)

### 7. The new shell's way

- No `spirit.shell.activateApp` in `info.js`.
- On the page, `spirit.require('spirit/app/info/info.js')` sets `spirit.element.spirit.app.info.info`, whose `create(container, opts)` draws into the container and answers `{ destroy() }`.
