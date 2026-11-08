# No run://node_modules/: the vendored folders

goal/G43.25, `spirit/run/spirit/test/vendoredFolders.js`.

Andy: "can we hide those suckers in spirit/jobs/ for now? without the damn node_modules container?"

The tree is read as it is. The watcher runs in child processes on scratch folders inside spirit/run, which are removed afterwards. No node and no port are used. The tree before the move is commit 2fb29140, which holds spirit/run/node_modules/.

## Requirements

- **Both folders move whole.** All 12 files of chokidar and readdirp are in git under spirit/jobs/chokidar/ and spirit/jobs/readdirp/. Each file is byte for byte as it was, except chokidar's index.js. Each folder keeps its package.json and licence. spirit/run/node_modules/ is gone from the disk and from git.
- **chokidar finds readdirp by path.** index.js:6 imports from "../readdirp/index.js". No other line of index.js changes, and nothing in it names readdirp by name.
- **The two users require it by path.** spirit/jobs.js and deskClient.js each require a path that resolves to spirit/jobs/chokidar/index.js. No script does require("chokidar") by name.
- **The file watcher works as before.**
  - The node's fs-watcher job hears a file made in its folder as a createFile.
  - The library deskClient requires, watching a folder, hears a file added.
- **No file names spirit/run/node_modules.** That covers the .gitignore exception, the two installers and the fsWatcherCommands test, which checks spirit/jobs/chokidar instead. The desk's currentGoal.json quotes the boxes and is left out.
- **One list, in fileSystem.js.**
  - fileSystem.js exports one list of exactly spirit/jobs/chokidar, spirit/jobs/readdirp and spirit/element/codeMirror.
  - The node's file scan lists nothing inside them.
  - Vendor code is "servable but not writeable" (Andy, Q1): a file of each of the three folders is servable, and fileWritable refuses it.
  - Every walker that skipped node_modules at 2fb29140 now reads that list and has no skip of its own: 48 walkers, word.js and oneDoor.js among them. The five that skipped codeMirror beside node_modules drop that too.
