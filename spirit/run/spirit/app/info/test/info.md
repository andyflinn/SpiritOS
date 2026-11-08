# spirit/app/info/info.js

The Info app (goal/G40.10, G41.6, G43.24): what this node says about itself to anybody who asks, its name and its
description; the two relay forms; and the key rotation. Since goal/G43.24 it is an app of `spirit/app/`, intrinsic by its
own `info.json`, and a wrapper (Andy: *"no i want those apps to basically be wrappers for spirit/element/ things...."*):
all of Info is the element nodeInfo (`spirit/element/nodeInfo.js`, its contract `spirit/element/test/nodeInfo.md`).
Its test is `./info.js`; its manifest, its tile and its opening in a real Chrome are judged in
`spirit/app/info/test/info-wrapper.js`.

## Requirements

- **Mounted the new shell's way** (Andy: *"box that these apps must mount in the new format of the new shell."*), as
  `spirit/app/file/file.js` is: it sets `spirit.elements.info = { create(container, { open }) -> { destroy() } }`. No
  `spirit.shell.activateApp`.
- **A wrapper**: it loads `spirit/element/nodeInfo.js` through `spirit.require` (rule/26), and only that. It asks nothing
  itself (no verb, no api, no cache manager, no relay, no card) and draws no markup of its own.
- `create(container, opts)` empties the container and, once nodeInfo is loaded, makes
  `spirit.elements.nodeInfo.create(container, { open })`, handing on `opts.open`, the stack its mounter opens layers in,
  and nothing else; made with no opts, nodeInfo gets no `open` and keeps its own stack.
- nodeInfo refused, the container says *Info could not be loaded.*
- `destroy()` destroys nodeInfo and empties the container; destroyed before nodeInfo loads, nothing is made.

## What its test must try to break

- Anything Info asks or draws itself instead of nodeInfo.
- A mount through the old shell.
- The mounter's `open` not handed on, or something else handed with it.
- nodeInfo made after destroy, or left undestroyed.
