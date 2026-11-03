# appMigration.js

`spirit/run/shell/appMigration/appMigration.js` is a throw-away face app (goal/G43.2). Its test is `./appMigration.js`.

Andy, box: *"when all apps and processes are migrated, andy will simply delete the folder"*.

## Requirements

- Its manifest is the one Andy committed himself (cf4ce075), for its name and icon. The box's *"no manifest"* is not asserted.
- At home it has a tile with no switch and no star (Andy: *"on loop-back you simply disregard if there is a fucking star or not"*).
- Opened from the face's desktop, it shows one tile per app, as the desktop's tiles: Andy, box: *"appMigration will now do the appSelector search under the hood, by calling spirit.app.search(""), and display the icons it finds as tiles."* The call takes an object, `spirit.app.search({ q: "" })`. No search box shows.
- A pressed tile opens that app on top of it, in an internal `appContainer` (Andy, box: *"that shows a titlebar, and a pane below, into which the "elements" are mounted"*):

      .app-container
        .app-container-bar     the titlebar
          .app-container-head  on its left edge, the tile's icon and label
          .app-container-close on its right edge
        .app-container-pane    below it, the app's element

- Close closes it, and the tiles are back (*"when the close button on the titlebar is pressed, the "app" closes again"*).
- No shell notices (*"NO INTERFERENCE FROM ANY FUCKING SHELL"*): the shell's title and its own button stay as they were.
- **Who paints, listens** (Andy, G41.32): a change to `server.json` on the disk paints the tile with no reload.
- Nothing outside its folder names it, so his delete breaks nothing.
