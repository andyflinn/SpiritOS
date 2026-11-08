# The node writes no preferences.json

goal/G43.17. Its test is `./fileSystem-noPreferences.js`: a real node on a scratch copy of the tracked files.
`spirit/fileSystem.js` held `preferences.json` as the node's one writable root file (`WRITABLE_ROOT_FILES`) until 7bfb9514,
so what the node writes is judged beside it (goal/G43.28; moved from `spirit/test/nodeSettings-noPreferences.js`).

Andy: *"i want to remove that information and all the code that references it, gone."*, *"go do it!"*

## Requirements

- The node writes no `preferences.json`: a scratch node comes up, and its run root holds none. A node that does not come up is red, never a vacuous green.
