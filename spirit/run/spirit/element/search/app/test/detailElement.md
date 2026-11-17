# appSelector/detailElement.js

One app's detail (goal/G43.2). Its test is `./detailElement.js`.

    spirit.element.spirit.element.search.app.detailElement.create(host, { row, panel }) -> { destroy() }

- Without `panel`, it shows the app's icon and label, the row element a list row is, and the appInstaller's
  activate/deactivate button for `spirit/app/<name>/<name>.js`.
- With `panel: true` (the pane's detail, under a title bar), it is a column of rowForms: changeAppIcon, changeAppLabel,
  rowFormAppActive, serverDEBUG, the Home shell and Face shell rows (rowFormSetShell), and the task row below (spirit/element/monitor/task.js).
- `destroy` empties its host.
- With `panel: true`, it fills its host and scrolls its own body, so the panel's title bar above it stays (Q21: the panel
  itself never scrolls); judged by `spirit/element/test/search-child-browser.js`.
- goal/G43.21, Andy, the box: *"the app detail will show a run button."* With `panel: true`, an app whose `<name>.json` says `node.run: true` shows its task row, `spirit/element/monitor/task.js` mounted with `spirit.app.<name>` (goal/G47.1; Andy: *"yes make it an improvement on the current run-rowForm in app and isolate it as spirit/element/monitor/task.js"*): its label and a Run button; a press asks `job.create` to start `spirit/app/<name>/<name>.js`. What the task row does past that is its own test's. An app without `node.run` shows no Run. Its job is the app's route, `spirit.app.<name>`. Its press is rowForm's `press` (goal/G47.1, Q20; Andy: *"mark the button busy from press until the mounter's answer comes"*): the button is busy, disabled with its turning mark, until the node answers, and a plain button again after. Its test plants an app of its own, `zzrun`, whose script does nothing and ends, and presses Run for real; a real app's Run is never pressed by a test.
