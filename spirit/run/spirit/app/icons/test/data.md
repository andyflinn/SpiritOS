# spirit/app/icons/data.js, what a page knows of the icon set

Its test is `./data.js`. The box (goal/G43.19, v16): *"it implements a database-table interface, also reflected in api.js and data.js"*, and 10: *"data.js on every open page follows that one job"*, `spirit.app.icons`.

The translator runs as it does: in a window of its own beside the real `spirit.data` (`spirit/data.js`); a run's rows are handed in as the node's stream hands them, jobs of module `spirit.app.icons`.

## Requirements

- `spirit.data.icons.data` answers `rows()`, `row(glyph)` and `watch(fn)`.
- A run's publish, `{ icons: { row } }`, puts the row on the page, its glyph and keywords; a changed row replaces it.
- `{ icons: { glyph, removed: true } }` takes the row away.
- A watch hears a new row by its glyph and a row gone, answers its release, and released hears nothing more.

## What its test must try to break

- A row on another app's job (`spirit.app.desk`) is not taken.
- Crooked publishes (null, text, a number, a list, no row, a row with no glyph, a removal with no glyph, another branch) change nothing and throw nothing.
- Keywords that are no list are never kept as one; removing an icon that is not there changes nothing.
