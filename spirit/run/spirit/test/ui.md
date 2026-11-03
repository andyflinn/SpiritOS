# ui.js

`spirit/run/spirit/ui.js` is a shell element (goal/G43.2): what `appMigration` did. Andy, box: *"create a shell element "run/spirit/ui.js", and put into that what appMigration does"*. Its test is `./ui.js`.

    spirit.elements.ui.create(container) -> { destroy() }

## Requirements

- It finds the apps through `spirit.app.search({ q: "" })`, under the hood with no search box, and shows one tile per app, as the desktop's tiles (`.app-icon`).
- A pressed tile opens that app's element on top of it, in an internal `appContainer` (*"that shows a titlebar, and a pane below, into which the "elements" are mounted"*):

      .app-container
        .app-container-bar     the titlebar
          .app-container-head  on its left edge, the tile's icon and label
          .app-container-close on its right edge
        .app-container-pane    below it, the app's element

- Close closes it, and the tiles are back.
- **Who paints, listens** (Andy, G41.32): a change to `server.json` on the disk paints the tile with no reload.
- Its code does not name `appMigration`, so his delete breaks nothing. `destroy` empties its container.
