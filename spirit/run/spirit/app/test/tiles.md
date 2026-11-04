# tiles.js

`spirit/run/spirit/app/tiles.js` shows the apps as tiles (goal/G43.2, goal/G43.6). Andy, box: *"spirit/app/tiles.js: an element, a probabilitySearch variant, that displays its list as tiles, with extra info in a tooltip."* Its test is `./tiles.js`. The tile face itself is `spirit/element/test/probabilitySearchTiles.js`'s.

    spirit.app.tiles.createApp(container) -> { destroy() }

## Requirements

- It finds the apps through `spirit.app.searchApp({ q: "" })`, with one search field, and shows one tile per app, as the desktop's tiles (`.app-icon`).
- A pressed tile opens that app's element on top of it, in an internal `appContainer` (*"that shows a titlebar, and a pane below, into which the "elements" are mounted"*):

      .app-container
        .app-container-bar     the titlebar
          .app-container-head  on its left edge, the tile's icon and label
          .app-container-close on its right edge
        .app-container-pane    below it, the app's element

- Close closes it, and the tiles are back.
- **Who paints, listens** (Andy, G41.32): a change to `server.json` on the disk paints the tile with no reload.
- Its code does not name its throw-away host, so his delete breaks nothing. `destroy` empties its container.
- `spirit/ui.js`, `spirit/test/ui.js` and `spirit/test/ui.md` are gone, and `spirit.elements.ui` with them.
- *"The app tiles open it from spirit.app."* The Monitor tile opens `spirit.app.monitor` (goal/G43.6). `server` stays on `spirit.elements` and opens as before.
