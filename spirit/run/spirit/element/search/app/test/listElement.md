# spirit/element/search/app/listElement.js — its own test

The app list, a drop-in element (goal/G43.2), the list the app selector (`../app.js`) draws: a view of the app family's
cache, asked of `app.search`. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72);
until now judged only through its selector (`../../test/app.js`). Mounted alone in a real Chrome on a scratch node's face
page; what each face must list is read from each `spirit/app/<name>/<name>.json`.

- It loads through `spirit.require` and stands at `spirit.element.spirit.element.search.app.listElement`.
- `create(host, opts)` answers `{ list, refresh, destroy }`; as a pane it lists every app of the tree, the apps that only
  run among them; it asks `app.search` with a search string and nothing more (Andy, box: *"no filters, just a search
  string"*).
- A pane row: icon, label, and the active cell at its end (*"with the (de)activate buttons at the end of each row"*).
- A press hands the row and its key to `pick`; `refresh` asks again; `destroy` leaves its host empty.
- Tiles: only the apps whose `<name>.json` says `shell.mount` true (goal/G43.20; Andy: *"MAKE SURE aN APP WITHOUT
  shell:mount NEVER SHOWS A FUCKING TILE!"*).
- A dropdown: no app that only runs (goal/G43.21), and icon and label only (*"the appSelector will only show icon and
  label in the list."*).
- `shells: true`: only the apps whose `<name>.json` says `shell.true` (goal/G43.18, box v29).
- The server filter hidden by default, shown by `servers: true` (goal/G43.18, Q4).

Not tried here: the refresh on a forgotten branch (a connect's `forget`, goal/G41.3).

## What its test must try to break

A tile for an app without `shell.mount`; a run-only app in a dropdown; the active cell in a dropdown; a non-shell in the
shell dropdowns.
