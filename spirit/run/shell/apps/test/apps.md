# shell/apps/apps.js

The Apps app (goal/G30.21; goal/G41.1, box v14): every app of this node as a list, a view of the Files cache, and
each app's details panel. Each app is switched on and off by the app installer (`shell/js/appInstaller.js`).

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api) })` into a box of a stated size (`fill`, rule/16),
  and loads what it uses through `spirit.require`, the app installer among them.
- **Its rows are two types only** (box v14): shell apps that depend on no appServer, and appServers.
  - An app is a `<name>/<name>.js` under `shell/` or `process/js/` with its `<name>.json` beside it in the Files cache.
  - A shell app whose manifest names a `server` is no row: it goes with its server.
  - Under `process/js/` only a server is a row (its manifest's `kind` is `"server"`).
  - Every app's manifest is read once before the list is drawn, so the rows are decided by what the manifests say.
- **The list has one column more**, `installer`: each row's cell holds the app installer for that app's script. The
  row's element mounts it into that cell and destroys it with the row.
- **The details panel**, a page on the navigation:
  - Shows the app's path, its type, where it runs, and whether it is intrinsic, read-only: intrinsic is decided by the
    development team and set by hand in the sidecar.
  - Has no checkbox at all; it shows the app installer instead.
  - Its name, icon and description are still edited on the face; a change writes the whole face part with every other
    field kept as it was (`app`, `intrinsic`, `home`).

## What its test must try to break

- A shell app naming a server shown as its own row.
- A process that is no server shown as a row.
- A checkbox left in the panel.
- A face part losing `app`, `intrinsic` or `home` when the name is saved.
