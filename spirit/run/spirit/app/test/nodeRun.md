# An app that is run, not mounted

goal/G43.21. Its test is `./nodeRun.js`: a real Chrome on a scratch node's face page, with the tree's apps whose `<name>.json` says `node.run` true, pushOrigin and publishData. The scratch tree is no git clone, so a pushOrigin started there pushes nothing.

Andy, the box: *"spirit app search will list these jobs (node:run) only in pane mode, bacause it they have no shell-mount. the app detail will show a run button."*, and *"the Andy user on each box will run those scripts when he feels like it"*.

## Requirements

- The app search in pane mode lists every app that says `node.run`.
- In dropdown mode, pressed open, it lists the apps that mount, and none that says `node.run`.
- The app detail of each such app shows a Run button; the detail of an app that mounts and says no `node.run` shows none.
- A press on Run starts `spirit/app/<name>/<name>.js`, a job of `spirit.app.<name>`, though the app is not active.
