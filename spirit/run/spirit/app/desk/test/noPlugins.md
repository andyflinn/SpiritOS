# The desk without apps, plugins and team chat

goal/G43.22. Its test is `./noPlugins.js`: the tree read as it is, and a desk server of the tree started on a scratch state folder, asked through its own pipe.

Andy, the box: *"the apps and plugin system goes."*, *"there will only be goals, items and rules left, plus the verifier stuff can stay for now."*, *"removal of plugin support"*, *"removal of plugin folders."*

## Requirements

- The plugin folders are gone: `spirit/app/desk/plugins/`, `spirit/app/desk/element/desk/plugins/`, and `shell/stackFrameCheckDetail/`.
- `desk.js` mounts no plugin and asks none for a refusal; its api serves no verb of a plugin (`stackFrameChecks.*`, `vision.*`, `fallout.*`).
- Andy (Q5): *"G0 goes, from ui and server, kept in database."*: `desk.js`, the desk page, its cache (`spirit/app/desk/data.js`) and `deskClient.js` name no `goal/G0`, and a fresh desk holds none. The page draws no Apps tab and no plugin tab.
- Andy (Q3): the verifier stays, its recording of the Stacks door verdicts not: deskVerify's api has no `door.record`.
- Andy: *"take out your search of the items text"*, *"take out the chat-search do, it's not actually usable."*: the item detail has no find field over its box and no chat search.
- Andy: *"publishData summary is no longer needed, i only check on github."*: publishData posts nothing to the desk.
- Andy (Q4): *"just stash that test.js and test.json in spirit/test/"*: `stackFrameList.json` and `violators.js` are kept in `spirit/test/`, `tools/wirePaths.js` reads the list there, and `stackFrameViolators.js` reads nothing from what goes.

## Found while reading, not asserted

- DISCREPANCY WITH ANDY's RULES ("removal of plugin support."): `spirit/app/desk/data.js` still handles a publish
  naming `plugin: 'stackFrameChecks'` and keeps the `deskDoors` / `deskDoorRuns` branches and their reads for it,
  though nothing publishes it any more. This test reads data.js only for `goal/G0`.
