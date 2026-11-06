# branchSelector/listElement.js

`spirit/run/spirit/element/search/branch/listElement.js` is the branch list (goal/G41.14), as
`spirit/element/search/contact/listElement.js` is the contacts list: the probabilitySearch the branch selector draws, pane or
dropdown, with its filter. Its test is `./listElement.js`.

Andy, box: *"the branchSelector element will use the standard apiFamilySelector and apiVerbSelector elements as pickers
for family and verb search filters, if no valid family is selected, the verb selector is invisible, set to \"(ALL)\"."*,
and since: *"apiFamiliySelector.js will use apiVerbSelector as part of itself"*: the family selector carries the verb.
Since goal/G41.14 it is a view of the node's branches (since goal/G41.28 the auth family's cache manager's,
`spirit.data.auth.data.branches.branch`), kept current by the node's stream, which its row element takes in (no data script, Andy: *"NO FUCKING DATA SCRIPT"*, *"THAT FUCKING ELEMENTS carry THEIR FUCKING DESCRIPTIONS"*), so every
list of branches on a page shows the same rows (Andy: *"EVERY FUCKING element MUST FUCKING LISTING to anything that changes
their data set"*).

## Requirements

- It loads what it uses itself (rule/26): `spirit/element/search.js`, `spirit/element/search/branch/rowElement.js` and
  `spirit/element/search/api.js`.
- It registers `spirit.element.branchList.create(host, opts)`, answering `{ list, refresh(), destroy() }`.
- It makes one family selector, `apiFamilySelector.create(…)` (the shell's element shape, goal/G41.19), and hands it
  to its one probabilitySearch in `host` as a selector, for the search's 🪣 row, with a name and a test narrowing by
  the family and verb chosen; no filter row of its own (goal/G41.26; Andy: *"any searchSelector in our system must go into the probabilitySearch's selectorRow, so that the user-can see, which elements belong to the search."*). It fills the search as soon as
  it is drawn.
- Its search asks `auth.branch { op: 'search', text, bundle, family, verb }` through the spirit object, the text
  trimmed, `bundle` from `opts.bundle`, and answers as a reply, `{ items, more }`.
- `opts.columns` names the row's fields it shows, in order (the branch editor: `family`, `verb`, `delete`).
  `opts.face`, `opts.placeholder`, `opts.all` and `opts.pick(row, key)` are handed on.
- Each row is a `branchElement` of that branch. Its search is handed no `matched()`: the whole row is matched (goal/G41.28; Andy, box v15: *"All client side searches will be fixed, too, and search the whole row, as cached in spirit.data."*).
- The filter, the family selector's `family` and `verb`:
  - nothing chosen: the search narrows by neither;
  - a family chosen searches again, narrowed by the family;
  - a verb chosen searches again, narrowed by both.
  The verb half's hiding until a family is chosen is the family selector's own.
- `refresh()` and `destroy()` reach the search element; `.list` is it. `destroy()` leaves `host` empty, the filters
  with it (box v23: *"destroy empties it"*).

- Its probabilitySearch's `data` is `branches`: the search's answers are seated there, and a row the stream changes redraws
  the list.

- A picked branch is shown as `family.verb`, or `family (ALL)`, never its number (the list's `name(row)`).

## What its test must try to break

- A part counted on that the list did not load itself.
- A search that leaves out its bundle.
- A filter change that does not search again.
