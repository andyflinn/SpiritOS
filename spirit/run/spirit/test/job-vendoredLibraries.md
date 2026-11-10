# No run://node_modules/: chokidar and readdirp in spirit/job/

goal/G43.25, `spirit/run/spirit/test/job-vendoredLibraries.js`: `spirit/job.js`'s part. The two libraries sit in `spirit/job/`, job.js's own folder, and job.js is the user that brings them.

Andy: "can we hide those suckers in spirit/jobs/ for now? without the damn node_modules container?"

The tree is read as it is. The watcher runs in a child process on a scratch folder inside spirit/run, removed afterwards. No node and no port are used. The tree before the move is commit 2fb29140, which holds spirit/run/node_modules/.

## Requirements

- **Both folders move whole.** All 12 files of chokidar and readdirp are in git under spirit/job/chokidar/ and spirit/job/readdirp/. Each file is byte for byte as it was, except chokidar's index.js. Each folder keeps its package.json and licence. spirit/run/node_modules/ is gone from the disk and from git.
- **chokidar finds readdirp by path.** index.js:6 imports from "../readdirp/index.js". No other line of index.js changes, and nothing in it names readdirp by name.
- **job.js requires it by path**, a path that resolves to spirit/job/chokidar/index.js. No script does require("chokidar") by name.
- **The file watcher works as before:** the node's fs-watcher job hears a file made in its folder as a createFile.
- **No file names spirit/run/node_modules.** That covers the .gitignore exception and the two installers.

deskClient's use of the library is `spirit/app/deskClient/test/deskClient-chokidar.md`; fileSystem.js's one list of vendored folders is `./fileSystem-vendoredFolders.md`.
