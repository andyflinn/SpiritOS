# The app cache keeps run and runOnly

goal/G43.23, item 9. Its test is `./data-runOnlyCache.js`: a real Chrome on a scratch node's face page. The app list is drawn in tiles mode, then the node's `apps` job replaces the rows the page holds (a label written through `app.label` on an app that mounts), and the tree's apps that are only run (`node.run`, neither `node.mount` nor `shell.mount`: pushOrigin, publishData) are looked at again.

The box: *"a node:run app shows as a tile with Activate: app/data.js drops run and runOnly (G43.21)."* Andy (G43.21): *"spirit app search will list these jobs (node:run) only in pane mode"*, and *"an app that only has node:run and no node:mount or shell:mount cannot be "activated""*.

## Requirements

- Every row of a run-only app that the app cache (`spirit.data.app`) holds once the `apps` job has come keeps `run` and `runOnly`, while a list is on the page and with none.
- The tiles, on the page while the job comes, never draw a tile for a run-only app.
- The app detail of a run-only app, made after the job, shows no Activate, where an app that mounts shows one.
