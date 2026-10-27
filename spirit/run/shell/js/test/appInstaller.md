# shell/js/appInstaller.js

The app installer (goal/G41.1, box v14): a standard shell element, one activate/deactivate button for one app, drawn
the same wherever it is used (the Apps list's column, the app's details panel). Install and uninstall come later.

## API

- `spirit.elements.appInstaller.create(host, { path })` draws into `host` and returns `{ destroy() }`. `path` is the
  app's script: `shell/<name>/<name>.js` (a shell app) or `process/js/<name>/<name>.js` (an appServer).

## Requirements

- **What it reads**: the app's annotations through the spirit object (`fs.getAnnotations(path)`), their face part.
- **Exempt**: an intrinsic app (its face part says `intrinsic: true`, set by hand by the development team) and the Apps
  app itself (`shell/apps`) get no button, only a note that they are always on.
- **A shell app**: it is on while its face part says `app: true`.
  - A press writes the whole face part with `app` turned over and every other field kept (`fs.annotate`), then tells
    the face shell (`spirit.shell.faceApp('shell/<name>')`) when there is one.
  - It draws only what the node answers: the annotations read again after the write, never the click.
- **An appServer**: it is on while the server runs: a server job of its module (`process/js/<name>`), running or
  pending, on the stream (`spirit.events.subscribe`).
  - A press writes the whole face part with `home` turned over and every other field kept; the node then starts or
    stops the server.
  - It draws only what the stream says (rule/19): a press leaves the button as it was until the job changes.
- **The button** says `Activate` while off and `Deactivate` while on, and carries `data-on`.
- **A press stays its own**: the click does not reach the row or panel around it (a row's press opens its details).
- **destroy** ends its stream subscription; nothing is drawn after it.

## What its test must try to break

- A face part losing a field when the switch is written.
- A button that follows the click instead of the node.
- A server job of another module, or one that is failed or cancelled, counted as running.
- An intrinsic app or the Apps app given a button.
- A press that also opens the row's details.
