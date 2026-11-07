# appSelector/listElement.js

The app list (goal/G43.2), as `spirit/element/search/bundle/listElement.js` is the bundle list: the probabilitySearch the selector draws. Its test is `./listElement.js`.

    spirit.elements.appList.create(host, opts) -> { list, refresh(), destroy() }; opts.face, opts.pick(row, key)

- It draws what `app.search` finds, asking with a search string and nothing more.
- A press hands the row to `pick`. `refresh` asks again. `destroy` empties its host.
- goal/G43.18, Andy: *"The app search gains a server filter, node.mount true and active ... this filter is hidden by default."* Q4: *"The programmer who uses app:search makes it visible"*, as `create(host, { servers: true })`.
  - Without `servers: true`, no filter; with it, one.
  - Pressed, it draws exactly the apps whose `<name>.json` says `node.mount: true` and that are active; switched off, the app leaves it. Pressed again, every app is back.
- goal/G43.21, Andy, the box: *"spirit app search will list these jobs (node:run) only in pane mode"*: an app whose row says `run` (its `<name>.json` says `node.run: true`) is drawn in the pane face only, never in the dropdown or the tiles; the face followed is the one the list shows now, a toggle included. A filter with no button. The full test is `../../../../app/test/nodeRun.js`.
