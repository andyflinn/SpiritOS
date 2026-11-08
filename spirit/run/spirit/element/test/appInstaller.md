# spirit/element/appInstaller.js

The app installer (goal/G41.1, box v14): a standard shell element, one activate/deactivate button for one app, drawn
the same wherever it is used (the app's details panel, `spirit/app/appSelector/detailElement.js`). Install and uninstall
come later.

## API

- `spirit.element.appInstaller.create(host, { path })` draws into `host` and returns `{ destroy() }`. `path` is the
  app's script, `spirit/app/<name>/<name>.js`.

## Requirements

- **An app in spirit/app** (goal/G43.9): it is on while its row in `spirit.data.app` says `active: true`
  (`spirit.cacheManager('app')`, then `watchApp(key)`).
  - A press asks the node, `spirit.app.activeApp({ key, active })`, the row's active turned over.
  - It draws only what the stream then brings (rule/19): a press leaves the button as it was until the row changes.
- **An intrinsic app** (its row says `intrinsic: true`) gets no button and no note (goal/G43.15).
- **No face part** (goal/G43.20; Andy: *"drop the old shells face parts altogether."*): a shell app's script, or any path
  that is not an app's own script, gets nothing, and no face part is read or written.
- **The button** says `Activate` while off and `Deactivate` while on, and carries `data-on`.
- **A press stays its own**: the click does not reach the row or panel around it (a row's press opens its details).
- **destroy** ends its watch on the row; nothing is drawn after it.

## What its test must try to break

- A button that follows the click instead of the stream.
- An intrinsic app given a button.
- A shell app's script given a button, or a face part read.
- A press that also opens the row's details.
