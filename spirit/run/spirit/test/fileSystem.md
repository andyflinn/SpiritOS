

## The noPreferences part: the node writes no preferences.json

goal/G43.17. Its test, once `./fileSystem-noPreferences.js`, is a section of `./fileSystem.js`: a real node on a scratch copy of the tracked files.
`spirit/fileSystem.js` held `preferences.json` as the node's one writable root file (`WRITABLE_ROOT_FILES`) until 7bfb9514,
so what the node writes is judged beside it (goal/G43.28; moved from `spirit/test/nodeSettings-noPreferences.js`).

Andy: *"i want to remove that information and all the code that references it, gone."*, *"go do it!"*

### Requirements

- The node writes no `preferences.json`: a scratch node comes up, and its run root holds none. A node that does not come up is red, never a vacuous green.

## The vendoredFolders part: one list of vendored folders, in fileSystem.js

goal/G43.25, once `spirit/run/spirit/test/fileSystem-vendoredFolders.js`, now a section of `spirit/run/spirit/test/fileSystem.js`: `spirit/fileSystem.js`'s part.

Andy: "can we hide those suckers in spirit/jobs/ for now? without the damn node_modules container?"

The tree is read as it is. No node and no port are used. The tree before the move is commit 2fb29140.

### Requirements

- fileSystem.js exports one list of exactly spirit/job/chokidar, spirit/job/readdirp and spirit/element/codeMirror.
- The node's file scan lists nothing inside them.
- Vendor code is "servable but not writeable" (Andy, Q1): a file of each of the three folders is servable, and fileWritable refuses it.
- Every walker that skipped node_modules at 2fb29140 and is still in the tree now reads that list and has no skip of its own, fileSystem.js and word.js among them. The ones that skipped codeMirror beside node_modules drop that too. The old system's walkers under spirit/test/, oneDoor.js among them, went with it (e9c6cb8c, "KILL!"), so what is judged is what is left, more than 10 walkers.

The move of chokidar and readdirp itself is the vendoredLibraries part of `./job.md`.
