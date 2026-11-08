# One list of vendored folders, in fileSystem.js

goal/G43.25, `spirit/run/spirit/test/fileSystem-vendoredFolders.js`: `spirit/fileSystem.js`'s part.

Andy: "can we hide those suckers in spirit/jobs/ for now? without the damn node_modules container?"

The tree is read as it is. No node and no port are used. The tree before the move is commit 2fb29140.

## Requirements

- fileSystem.js exports one list of exactly spirit/jobs/chokidar, spirit/jobs/readdirp and spirit/element/codeMirror.
- The node's file scan lists nothing inside them.
- Vendor code is "servable but not writeable" (Andy, Q1): a file of each of the three folders is servable, and fileWritable refuses it.
- Every walker that skipped node_modules at 2fb29140 and is still in the tree now reads that list and has no skip of its own, fileSystem.js and word.js among them. The ones that skipped codeMirror beside node_modules drop that too. The old system's walkers under spirit/test/, oneDoor.js among them, went with it (e9c6cb8c, "KILL!"), so what is judged is what is left, more than 10 walkers.

The move of chokidar and readdirp itself is `./jobs-vendoredLibraries.md`.
