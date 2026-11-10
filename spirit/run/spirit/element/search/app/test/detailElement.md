# appSelector/detailElement.js

One app's detail (goal/G43.2). Its test is `./detailElement.js`.

    spirit.element.spirit.element.search.app.detailElement.create(host, { row, panel }) -> { destroy() }

- Without `panel`, it shows the app's icon and label, the row element a list row is, and the appInstaller's
  activate/deactivate button for `spirit/app/<name>/<name>.js`.
- With `panel: true` (the pane's detail, under a title bar), it is a column of rowForms: changeAppIcon, changeAppLabel,
  rowFormAppActive, serverDEBUG, the Home shell and Face shell rows (rowFormSetShell), and the Run row below.
- `destroy` empties its host.
- goal/G43.21, Andy, the box: *"the app detail will show a run button."* With `panel: true`, an app whose `<name>.json` says `node.run: true` shows a row [▶️] "Run <label>" [Run]; a press asks `jobs.create` to start `spirit/app/<name>/<name>.js`, and the line under it says started, or the refusal. An app without `node.run` shows no Run. The full test is `../../test/nodeRun.js`.
