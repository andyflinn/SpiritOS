# probabilitySearch, the face tiles

The third face of `spirit/element/search.js` (goal/G43.6). Its test is `./probabilitySearchTiles.js`, in a real browser, with rows of its own. The other faces are `./probabilitySearch.js`'s.

Andy, box: *"probabilitySearch gets a third face, 'tiles', beside 'pane' and 'dropdown': the same ranked rows, drawn as tiles. Any list can use it. No column headers or sorting; arrow keys also go left and right."*

## Requirements

- `face: 'tiles'`: one `.app-icon` tile per row, its image from `row.icon` above its label from `row.label`. No table, headers or sort triggers. One search field.
- With no words there is no bar, and its space stays: with words a tile's label stands where it stood.
- With words the best row comes first, with a bar between image and label, horizontal and centered: `.list-rank` as the lists draw it, the same colour and number.
- A tile the words miss stays, last, with an empty bar. Nothing is cut.
- Arrow keys go left and right as well, and Enter picks where they went. A pressed tile is the list's pick.
- The tooltip shows the row, one `path: value` above the other, drawn from the scan `probabilityStringObjectMatch` uses: `measureObject`, exported, whose rows carry their js object path (`stats.cpu`, `files[0].name`). The `icon` row is dropped.
- A pane stays a table with headers.

## The toggle (goal/G43.9)

- *"A new option, toggle: true. Without it nothing changes for any other list."* No option, no toggle, on a pane or on tiles.
- *"It flips pane and tiles only. Dropdown closes to a field, so it never shows the toggle."*
- *"The toggle sits on the search row, right after the Search button."* It is the next element after that button.
- *"The face can change while the list lives, keeping the search words."* A press draws the other face, words kept, and a second press goes back.
- *"It tells its owner the new face."*

The box names neither, so the test names them for the builder: the toggle is `.list-toggle`, and the owner hears through the option `onFace(face)`. If the build names them otherwise, the verifier corrects the test.

## What a list hands its tiles (goal/G43.17, Q14)

Andy, on Q14 *"May I change the shared search list, so the Files tiles can show each file's own icon and name?"*: *"yes."*

- The option `tile(row, key)` answers `{ icon, label }` for a tile. Either one left out is the row's own `row.icon` or `row.label`; without the option nothing changes for any other list.
- The files list hands a file its kind's icon (fstat's `iconOf`), a folder 📁 shut and 📂 open, and the file's name.
