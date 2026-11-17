# spirit/app/desk/nodeDesk.js: the desk server without plugins and team chat

goal/G43.22. Its test is `./nodeDesk.js`: the tree read as it is, and a desk server of the tree started on a scratch state folder, asked through its own pipe.

Andy, the box: *"the apps and plugin system goes."*, *"there will only be goals, items and rules left, plus the verifier stuff can stay for now."*, *"removal of plugin support"*, *"removal of plugin folders."*

## Requirements

- The plugin folders are gone: `spirit/app/desk/plugins/`, `spirit/app/desk/element/desk/plugins/`, and `shell/stackFrameCheckDetail/`.
- `nodeDesk.js` mounts no plugin and asks none for a refusal; the desk's api serves no verb of a plugin (`stackFrameChecks.*`, `vision.*`, `fallout.*`).
- goal/G47.1, Q16 (Andy, of old box versions: *"ALL OF THEM. KILL THEM."*): the desk's api serves `item.box` and no
  `item.box.search`.
- Andy (Q5): *"G0 goes, from ui and server, kept in database."*: `nodeDesk.js` names no `goal/G0`, and a fresh desk holds none.

## What went, in the desk's own test (goal/G47.4)

Moved here from `spirit/test/appServer.js`, being about the desk itself, not the app server (Andy: *"you make bloody well sure that such stupid hard-coded tests move to app-child-* immediately, or whatever is fucking appropriate"*):

- The desk server has no `bundled()` of its own (box v15, what goes).
- Nothing in the desk folder (its scripts and json, tests aside) names `DEPENDENCIES` or hands `serve()` a dependencies list (goal/G41.24, Andy: *"DEPENDENCIES will be killed, eradicated, from all code where it appears, and from the desk folder itself."*).
