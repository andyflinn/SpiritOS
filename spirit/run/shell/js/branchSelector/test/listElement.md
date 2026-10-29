# branchSelector/listElement.js

`spirit/run/shell/js/branchSelector/listElement.js` is the branch list (goal/G41.14), as
`shell/js/contacts/listElement.js` is the contacts list: the probabilitySearch the branch selector draws, pane or
dropdown, with its filter. Its test is `./listElement.js`.

Andy, box: *"the branchSelector element will use the standard apiFamilySelector and apiVerbSelector elements as pickers
for family and verb search filters, if no valid family is selected, the verb selector is invisible, set to \"(ALL)\"."*,
and since: *"apiFamiliySelector.js will use apiVerbSelector as part of itself"*: the family selector carries the verb.
No `data.js` beside it: the bundle and branch selectors never share a page.

## Requirements

- It loads what it uses itself (rule/26): `shell/js/probabilitySearch.js`, `shell/js/branchSelector/rowElement.js` and
  `shell/js/apiFamilySelector.js`.
- It registers `spirit.elements.branchList.create(host, opts)`, answering `{ list, refresh(), destroy() }`.
- It draws one family selector and one probabilitySearch in `host`, and fills it as soon as it is drawn.
- Its search asks `auth.branch { op: 'search', text, bundle, family, verb }` through the spirit object, the text
  trimmed, `bundle` from `opts.bundle`, and answers as a reply, `{ items, more }`.
- `opts.columns` names the row's fields it shows, in order (the branch editor: `family`, `verb`, `delete`).
  `opts.face`, `opts.placeholder`, `opts.all` and `opts.pick(row, key)` are handed on.
- Each row is a `branchElement` of that branch. A row is matched on its family and verb, never its hidden numbers.
- The filter, the family selector's `family` and `verb`:
  - nothing chosen: the search narrows by neither;
  - a family chosen searches again, narrowed by the family;
  - a verb chosen searches again, narrowed by both.
  The verb half's hiding until a family is chosen is the family selector's own.
- `refresh()` and `destroy()` reach the search element; `.list` is it.

## What its test must try to break

- A part counted on that the list did not load itself.
- A search that leaves out its bundle.
- A filter change that does not search again.
