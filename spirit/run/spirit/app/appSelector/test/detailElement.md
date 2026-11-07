# appSelector/detailElement.js

One app's detail (goal/G43.2). Its test is `./detailElement.js`.

    spirit.elements.appDetail.create(host, { row }) -> { destroy() }

- It shows the app's icon and label. An app has nothing else yet. wsl's reading, offered in the item and not objected to: the box names only what the list shows.
- `destroy` empties its host.
- goal/G43.21, Andy, the box: *"the app detail will show a run button."* With `panel: true`, an app whose `<name>.json` says `node.run: true` shows a row [▶️] "Run <label>" [Run]; a press asks `jobs.create` to start `spirit/app/<name>/<name>.js`, and the line under it says started, or the refusal. An app without `node.run` shows no Run. The full test is `../../test/nodeRun.js`.
