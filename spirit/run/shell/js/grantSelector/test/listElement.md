# grantSelector/listElement.js

`spirit/run/shell/js/grantSelector/listElement.js` is the grant list (goal/G41.14), as
`shell/js/bundleSelector/listElement.js` is the bundle list. It was the grants app's own list; the app draws it. Its test
is `./listElement.js`.

Andy: *"WHY DOES A GRANT NOT JUST SIMPLY UPDATE AN EXISTING FUCKING ROW?"*, *"INCLUDING COMPLETE TEST FOLDER FOR THE
COMPONENTS INVOLVED!!!!"*.

## Requirements

- It loads what it uses itself (rule/26): `shell/js/probabilitySearch.js` and `shell/js/grantSelector/rowElement.js`; no
  data script.
- It registers `spirit.elements.grantList.create(host, opts)`, answering `{ list, refresh(), destroy() }`.
- It draws one probabilitySearch pane into `host`, and fills it as soon as it is drawn.
- It is a view of `data.grants`, which the grant row element keeps from the node's stream: one grant appears or goes.
- Its search asks `auth.search { text }` through the spirit object, the text trimmed, and answers as a reply.
- Its columns are `name` (whose grant), `path` and `revoke`, Revoke the rightmost. Each row is a `grantElement`.
- A row is matched on whose grant it is and the words of its path, never the key.
- `opts.filters` are its own: the grants app hands it its ID and family filters.
- `refresh()` and `destroy()` reach the search element; `.list` is it.

## What its test must try to break

- A part counted on that the list did not load itself, or a data script.
- A list that keeps rows of its own instead of being a view of data.grants.
- Revoke anywhere but the rightmost column.
- A row matched on its key.
