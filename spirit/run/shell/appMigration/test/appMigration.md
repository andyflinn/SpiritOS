# appMigration.js

`spirit/run/shell/appMigration/appMigration.js` is a throw-away face app (goal/G43.2). Its test is `./appMigration.js`.

Andy, box: *"when all apps and processes are migrated, andy will simply delete the folder"*.

## Requirements

- Its manifest is the one Andy committed himself (cf4ce075), for its name and icon. The box's *"no manifest"* is not asserted.
- JUST a wrapper: Andy, box: *"put into that what appMigration does, and appMigration becomes JUST a wrapper for "run/spirit/ui.js""*. Its script draws nothing and asks nothing. What it mounts is judged in `spirit/test/ui.js`.
- Opened in the real shell, the desktop goes and ui's tiles show, and a pressed tile opens the app inside it.
- No shell notices (*"NO INTERFERENCE FROM ANY FUCKING SHELL"*): the shell's title and its own button stay as they were.
- Nothing outside its folder names it, so his delete breaks nothing.
- Since goal/G43.6 it wraps `spirit/app/tiles.js`, `spirit.app.tiles`: Andy's words above named the file that held it then.
