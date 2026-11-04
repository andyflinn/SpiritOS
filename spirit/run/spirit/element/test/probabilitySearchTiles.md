# probabilitySearch, the face tiles

The third face of `spirit/element/probabilitySearch.js` (goal/G43.6). Its test is `./probabilitySearchTiles.js`, in a real browser, with rows of its own. The other faces are `./probabilitySearch.js`'s.

Andy, box: *"probabilitySearch gets a third face, 'tiles', beside 'pane' and 'dropdown': the same ranked rows, drawn as tiles. Any list can use it. No column headers or sorting; arrow keys also go left and right."*

## Requirements

- `face: 'tiles'`: one `.app-icon` tile per row, its image from `row.icon` above its label from `row.label`. No table, headers or sort triggers. One search field.
- With no words there is no bar, and its space stays: with words a tile's label stands where it stood.
- With words the best row comes first, with a bar between image and label, horizontal and centered: `.list-rank` as the lists draw it, the same colour and number.
- A tile the words miss stays, last, with an empty bar. Nothing is cut.
- Arrow keys go left and right as well, and Enter picks where they went. A pressed tile is the list's pick.
- The tooltip shows the row, one `path: value` above the other, drawn from the scan `probabilityStringObjectMatch` uses: `measureObject`, exported, whose rows carry their js object path (`stats.cpu`, `files[0].name`). The `icon` row is dropped.
- A pane stays a table with headers.
