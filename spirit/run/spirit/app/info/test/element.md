# spirit/app/info/element.js

The Info app (goal/G40.10, G41.6, G43.24): what this node says about itself to anybody who asks, its name and its
description; the two relay forms; and the key rotation. Since goal/G43.24 it is an app of `spirit/app/`, intrinsic by its
own `info.json`, and a wrapper (Andy: *"no i want those apps to basically be wrappers for spirit/element/ things...."*):
all of Info is the element nodeInfo (`spirit/element/nodeInfo.js`, its contract `spirit/element/test/nodeInfo.md`).
Its test is `./info.js`; its manifest, its tile and its opening in a real Chrome are judged in
its wrapper part (below).

## Requirements

- **Mounted the new shell's way** (Andy: *"box that these apps must mount in the new format of the new shell."*), as
  `spirit/app/file/element.js` is: it sets `spirit.element.spirit.app.info.element = { create(container, { open }) -> { destroy() } }`. No
  `spirit.shell.activateApp`.
- **A wrapper**: it loads `spirit/element/nodeInfo.js` through `spirit.require` (rule/26), and only that. It asks nothing
  itself (no verb, no api, no cache manager, no relay, no card) and draws no markup of its own.
- `create(container, opts)` empties the container and, once nodeInfo is loaded, makes
  `spirit.element.spirit.element.nodeInfo.create(container, { open })`, handing on `opts.open`, the stack its mounter opens layers in,
  and nothing else; made with no opts, nodeInfo gets no `open` and keeps its own stack.
- nodeInfo refused, the container says *Info could not be loaded.*
- `destroy()` destroys nodeInfo and empties the container; destroyed before nodeInfo loads, nothing is made.

## What its test must try to break

- Anything Info asks or draws itself instead of nodeInfo.
- A mount through the old shell.
- The mounter's `open` not handed on, or something else handed with it.
- nodeInfo made after destroy, or left undestroyed.

## The wrapper part: spirit/app/info/element.js: Info, a wrapper mounted the new shell's way

goal/G43.24, requirements 1 to 7, for Info. Its test is the wrapper part of `./element.js`: the tree read as it is, `./element.js` run (its own checks, not this part again), then a real node on a lab node reset to the files under test (goal/G47.3) (tracked and new, not ignored) and real clicks in a real Chrome on `/face.html`, on the shell app (`spirit/app/app/element.js`) as boot.js draws it.

Andy: *"i just moved them, didn't fix the manifest."* (4f01465b: shell/info is spirit/app/info/, shell/grants is spirit/app/grants/), *"no i want those apps to basically be wrappers for spirit/element/ things...."*, and *"box that these apps must mount in the new format of the new shell."*

### Requirements

#### 1. The manifest

- `info.json` holds what `file.json` holds, the spirit/app form: identity `{icon, label, intrinsic: true}`, mount `{"info.js": true}`, shell `{true: false, mount: true, tile: true}`, node `{mount: false}`, and nothing of the old form.
- Icon and label as they were: Info ℹ️.
- Q1, the old description sentence: *"it goes."*

#### 2. Intrinsic by its own `info.json`

- The node's `app.search` lists info intrinsic, so always active. (Its leaving coreFiles.js's INTRINSIC list is `spirit/test/coreFiles.js`; the old shell's list, `spirit/client/test/shell-infoGrants.js`.)

#### 3. In the shell as before

- With nothing pressed, the shell shows its tile.
- Info's tile opens Info: its name and description fields (`data-field` label and description) and its Rotate this node's cipher key button, nothing "could not be loaded", one bar in view, `ℹ️ Info`; its ✕ shows the tiles again.

#### 4. Its test runs from the new place

- `spirit/app/info/test/element.js` runs with no "Cannot find module" and prints testReport's completion line.

#### 5. Nothing names the old place

- No file of the tree (tracked, or new and not ignored) names `shell/info`; the red files that must name it are left out.

#### 6. A wrapper of spirit/element/

- `info.js` loads only `spirit/element/` scripts, through `spirit.require`; asks no cacheManager; calls no verb (`.verb(`, `spirit.outcome`, `callDialog`, `fetch`, relay.status, node.card, auth.search/grant/revoke); draws no markup of its own.
- Info's own parts move into `spirit/element/nodeInfo.js` (Q2: *"nodeInfo is fine."*): info.js loads it. (What nodeInfo asks and draws is `spirit/element/test/nodeInfo.js`, its parts section.)

#### 7. The new shell's way

- No `spirit.shell.activateApp` in `info.js`.
- On the page, `spirit.require('spirit/app/info/element.js')` sets `spirit.element.spirit.app.info.element`, whose `create(container, opts)` draws into the container and answers `{ destroy() }`.
