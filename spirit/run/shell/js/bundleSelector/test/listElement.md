# bundleSelector/listElement.js

`spirit/run/shell/js/bundleSelector/listElement.js` is the bundle list (goal/G41.14), as
`shell/js/contacts/listElement.js` is the contacts list: the probabilitySearch the bundle selector draws, pane or
dropdown. Its test is `./listElement.js`.

Andy, box: *"bundleSelector.js and bundleSelector/ folder, featuring a pane mode and a dropdown mode for displaying and
selecting bundle rows."* No `data.js` beside it: the bundle and branch selectors never share a page (Andy: *"nothing on
this page says that any of those two tables/Selectors will be on the same page."*).

## Requirements

- It loads what it uses itself (rule/26): `shell/js/probabilitySearch.js` and `shell/js/bundleSelector/rowElement.js`.
- It registers `spirit.elements.bundleList.create(host, opts)`, answering `{ list, refresh(), destroy() }`.
- It draws one probabilitySearch into `host`, and fills it as soon as it is drawn.
- `opts.face`, `opts.placeholder`, `opts.all` and `opts.pick(row, key)` are handed on, as probabilitySearch's.
- Its search asks `auth.bundle { op: 'search', text }` through the spirit object, the text trimmed, and answers as a
  reply, `{ items, more }`. An empty answer is an empty list.
- A row is matched on its label, never its hidden id.
- Each row is a `bundleElement` of that bundle, `{ id, label }`.
- By default its one column is the label. `opts.columns` names the row's fields it shows, in order (the bundle editor:
  `label`, `edit`, `delete`). `opts.editable` makes each row edit its label in place.
- `refresh()` and `destroy()` reach the search element; `.list` is it.

## What its test must try to break

- A part counted on that the list did not load itself.
- A search asked anywhere but `auth.bundle`'s, or with its op or text wrong.
- A row matched on its id.
- Columns or editing handed to a dropdown that did not ask for them.
