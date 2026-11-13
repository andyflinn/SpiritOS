# spirit/app/desk/nodeDesk.js: the desk server without plugins and team chat

goal/G43.22. Its test is `./nodeDesk.js`: the tree read as it is, and a desk server of the tree started on a scratch state folder, asked through its own pipe.

Andy, the box: *"the apps and plugin system goes."*, *"there will only be goals, items and rules left, plus the verifier stuff can stay for now."*, *"removal of plugin support"*, *"removal of plugin folders."*

## Requirements

- The plugin folders are gone: `spirit/app/desk/plugins/`, `spirit/app/desk/element/desk/plugins/`, and `shell/stackFrameCheckDetail/`.
- `nodeDesk.js` mounts no plugin and asks none for a refusal; the desk's api serves no verb of a plugin (`stackFrameChecks.*`, `vision.*`, `fallout.*`).
- Andy (Q5): *"G0 goes, from ui and server, kept in database."*: `nodeDesk.js` names no `goal/G0`, and a fresh desk holds none.
- goal/G47.1, Andy: *"and desk still names deskVerify???? in my titlebar, right here? goal/G47.1 — Ad hoc cycle. (waiting for deskVerify)"*: an older desk's item whose status the deleted verifier wrote (`waiting for deskVerify`) has that status emptied when the desk starts, never replaced by a guessed one; an item with a status of its own (`running`) keeps it. Judged on a desk restarted over rows written into its `desk.db`.
