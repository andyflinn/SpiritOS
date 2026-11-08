# deskClient watches its clone with chokidar from spirit/jobs/

goal/G43.25, `spirit/run/spirit/app/deskClient/test/deskClient-chokidar.js`: `deskClient.js`'s part of the move of chokidar and readdirp into spirit/jobs/.

Andy: "can we hide those suckers in spirit/jobs/ for now? without the damn node_modules container?"

The watcher runs in a child process on a scratch folder inside spirit/run, removed afterwards.

## Requirements

- **deskClient.js requires it by path**, a path that resolves to spirit/jobs/chokidar/index.js.
- **The file watcher works as before:** the library deskClient requires, watching a folder, hears a file added.

The move itself is `spirit/test/jobs-vendoredLibraries.md`.
