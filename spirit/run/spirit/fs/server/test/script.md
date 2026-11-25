# spirit/fs/server/script.js

The file watcher, the fs cache's one writer (goal/G49.15, box v16: *"The watcher leaves spirit/job/script.js for the fs branch,
with the flags. job/script.js keeps the jobs and the app starts."*; *"the watcher lands in spirit/fs/server/script.js and is
required by the node"*). `start(rootDir, jobs)` answers its job.

## Where it lives

- spirit/fs/server/script.js is there and answers start; job/script.js names no chokidar, no folderFlags and no
  startFsWatcherJob; the node requires it by its path; it requires the four flag conditions by theirs,
  spirit/fs/filter/api/, branch/, app/ and live/script.js; nothing is left in spirit/job/chokidar/ or spirit/job/readdirp/.

## The flags on a folder's row

On a scratch folder inside spirit/run, the watcher's rows, read from the fs dataset: a folder holding api.js and data.js
carries api, not branch; one holding script.js and client/script.js carries branch, not api; one holding script.js alone
carries neither; an app folder (<name>/<name>.json) carries app and is not live without a node.json; its
spirit/state/<name>/node.json written active true makes it live, changed to active false not live again.

## No run://node_modules/: chokidar and readdirp in spirit/fs/

goal/G43.25, moved with the watcher by goal/G49.15. The two libraries sit in `spirit/job/`, job.js's own folder, and job.js is the user that brings them.

Andy: "can we hide those suckers in spirit/jobs/ for now? without the damn node_modules container?"

The tree is read as it is. The watcher runs in a child process on a scratch folder inside spirit/run, removed afterwards. No node and no port are used. The tree before the move is commit 2fb29140, which holds spirit/run/node_modules/.

### Requirements

- **Both folders move whole.** All 12 files of chokidar and readdirp are in git under spirit/fs/chokidar/ and spirit/fs/readdirp/. Each file is byte for byte as it was, except chokidar's index.js. Each folder keeps its package.json and licence. spirit/run/node_modules/ is gone from the disk and from git.
- **chokidar finds readdirp by path.** index.js:6 imports from "../readdirp/index.js". No other line of index.js changes, and nothing in it names readdirp by name.
- **the watcher, spirit/fs/server/script.js, requires it by path**, a path that resolves to spirit/fs/chokidar/index.js. No script does require("chokidar") by name.
- **The file watcher works as before:** the node's fs-watcher job hears a file made in its folder as a createFile.
- **The core flag is kept on the file list** (goal/G47.1; Andy: *"stick that flag on the fucking file list, then you have to
  check each file once with isCore()"*): the fs-watcher job on the run folder, its tree asked twice, reads no app's
  <name>.json from disc; spirit/script.js comes with core, the `<name>.js` of an app whose json says intrinsic false
  (the first found in the checkout, none named) without, that json itself with. The flag follows an app's json: on a lab node reset to the files under test (goal/G47.3), a planted app
  zzKept whose json says intrinsic false has zzKept.js without core; the json changed to intrinsic true, zzKept.js comes
  with core; changed back, without again.
- **No file names spirit/run/node_modules.** That covers the .gitignore exception and the two installers.

deskClient's use of the library is the chokidar part of `spirit/app/deskClient/server/test/server.md`; fileSystem.js's one list of vendored folders is the vendoredFolders part of `./fileSystem.md`.
