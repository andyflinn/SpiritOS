# spirit/element/appInstaller.js

The app installer (goal/G41.1, box v14): a standard shell element, one activate/deactivate button for one app, drawn
the same wherever it is used (the Apps list's column, the app's details panel). Install and uninstall come later.

## API

- `spirit.element.appInstaller.create(host, { path })` draws into `host` and returns `{ destroy() }`. `path` is the
  app's script: `shell/<name>/<name>.js` (a shell app), `process/js/<name>/<name>.js` (an appServer) or
  `spirit/app/<name>/<name>.js` (an app in spirit/app).

## Requirements

- **What it reads**: the app's annotations through the spirit object (`fs.getAnnotations(path)`), their face part.
- **Exempt**: an intrinsic app (its face part says `intrinsic: true`, set by hand by the development team) and the Apps
  app itself (`shell/apps`) get no button, only a note that they are always on.
- **A shell app**: it is on while its face part says `app: true`.
  - A press writes the whole face part with `app` turned over and every other field kept (`fs.annotate`), then tells
    the face shell (`spirit.shell.faceApp('shell/<name>')`) when there is one.
  - It draws only what the node answers: the annotations read again after the write, never the click.
- **An appServer**: it is on while the server runs: a server job of its module (`process/js/<name>`), running or
  pending, as the jobs family's cache keeps it (`spirit.cacheManager('jobs')`, then `spirit.data.jobs.data`; goal/G41.28).
  - A press writes the whole face part with `home` turned over and every other field kept; the node then starts or
    stops the server.
  - It draws only what the cache says (rule/19): a press leaves the button as it was until the job changes.
- **Every button listens** (box v15: "it's the buttons that have to listen, too"): the node streams an app's face part
  as an `app-face` job (`{ path, face }`) whenever its sidecar changes. A button takes its own app's face part from it:
  a shell app's turns on or off with `app`, and an app made intrinsic loses its button. Another app's is ignored.
- **An app in spirit/app** (goal/G43.9): it is on while its row in `spirit.data.app` says `active: true`
  (`spirit.cacheManager('app')`, then `watchApp(key)`). A press asks the node, `spirit.app.activeApp({ key, active })`;
  the button draws what the stream then brings. A row that says `intrinsic: true` gets no button and no note
  (goal/G43.15). This test does not reach this path.
- **The button** says `Activate` while off and `Deactivate` while on, and carries `data-on`.
- **A press stays its own**: the click does not reach the row or panel around it (a row's press opens its details).
- **destroy** ends its watch on `spirit.data.jobs.data`; nothing is drawn after it.

## What its test must try to break

- A face part losing a field when the switch is written.
- A button that follows the click instead of the node.
- A server job of another module, or one that is failed or cancelled, counted as running.
- An intrinsic app or the Apps app given a button.
- A press that also opens the row's details.
