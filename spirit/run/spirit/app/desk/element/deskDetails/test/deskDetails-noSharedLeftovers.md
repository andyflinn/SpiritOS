# deskChat.js and deskElement.js gone from shell/shared

goal/G43.23, item 10 (after goal/G43.22). Its test is `./deskDetails-noSharedLeftovers.js`: the tree read as it is, tracked
files on disk. `deskChat.js` drew an item's chat, which the item detail, `deskDetails.js`, draws itself now, so their absence
is judged beside it (goal/G43.28; moved from `shell/shared/js/test/deskRunStatus-noDeskLeftovers.js`).

The box: *"plugin leftovers (G43.22): deskChat.js and deskElement.js in shell/shared, loaded by nothing"*. A test that reads a file gone from the tree is stale, G43.23 Q3: *"yes."*

## Requirements

- `spirit/run/shell/shared/js/deskChat.js` and `deskElement.js` are gone.
- Their tests are gone: `shell/shared/js/test/deskChat.js`, `deskChat.md`, `deskElement.js`, `deskElement.md`, and no other test or spec in a `test/` folder reads or names `deskChat.js`, `deskElement.js`, `createDeskChat` or `createDeskElement`. A spec that quotes the box's line is no use of them and is not counted.
- The world: the folder read holds `deskRunStatus.js`, `deskDetails.js` is beside this test, and the tracked files and tests read are many, so an empty read is red.
