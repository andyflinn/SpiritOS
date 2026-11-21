# spirit/app/desk/server/server.js: the desk server without plugins and team chat

goal/G43.22. Its test is `./server/server.js`: the tree read as it is, and a desk server of the tree started on a scratch state folder, asked through its own pipe.

Andy, the box: *"the apps and plugin system goes."*, *"there will only be goals, items and rules left, plus the verifier stuff can stay for now."*, *"removal of plugin support"*, *"removal of plugin folders."*

## Requirements

- The plugin folders are gone: `spirit/app/desk/plugins/`, `spirit/app/desk/element/desk/plugins/`, and `shell/stackFrameCheckDetail/`.
- `desk/server/server.js` mounts no plugin and asks none for a refusal; the desk's api serves no verb of a plugin (`stackFrameChecks.*`, `vision.*`, `fallout.*`).
- goal/G47.1, Q16 (Andy, of old box versions: *"ALL OF THEM. KILL THEM."*): the desk's api serves `item.box` and no
  `item.box.search`.
- Andy (Q5): *"G0 goes, from ui and server, kept in database."*: `desk/server/server.js` names no `goal/G0`, and a fresh desk holds none.

## What went, in the desk's own test (goal/G47.4)

Moved here from `spirit/server/test/app.js`, being about the desk itself, not the app server (Andy: *"you make bloody well sure that such stupid hard-coded tests move to app-child-* immediately, or whatever is fucking appropriate"*):

- The desk server has no `bundled()` of its own (box v15, what goes).
- Nothing in the desk folder (its scripts and json, tests aside) names `DEPENDENCIES` or hands `serve()` a dependencies list (goal/G41.24, Andy: *"DEPENDENCIES will be killed, eradicated, from all code where it appears, and from the desk folder itself."*).

## No core in the desk (2026-11-17)

Andy: *"The stupid core designation is worthless in desk anyway, EVERY FUCKING FILE is pretty much core, and the whold fucking process makes me give meaningess fucking grants for "core" files, may as well toss that shit from desk and make desk a little more simple"*; of the two columns left in desk.db: *"b) and don't bother filling that field with anything"*.

- Nothing in the desk folder (its scripts and json, tests aside) works out whether a file is core: no `coreFiles`, no `isCore`, no core grant, no core mark on a file.
- desk.db's `files` table keeps its `core` and `grant_status` columns, never altered; nothing reads them, and a new row carries a literal, NOT NULL allowing no less. The core grants already in the record stay.
