# spirit/element/search/contact.js, the contact picker

The peer picker apps build their screens with: Chat's peers pane, the grants panel's ID selectors. Since goal/G43.32 it is a
thin selector over the one contact list, `search/contact/listElement.js` (Andy: *"contact: there should be only 1 list, i
didn't even know there where two...."*, *"all, any search-unit has ONE list shared by popup and list modes."*); until then
it drew a list of its own. What that list alone did (any ID table, goal/G41.13; the caller's hidden filters; a mark column)
the contact list does now, tested in its folder. Its test is `./contact.js`: the browser file run in node on a bare window,
the list a stand-in that keeps what it was handed.

`spirit.element.spirit.element.search.contact.create(container, options)` -> root.

## Requirements

- It places itself at `spirit.element.spirit.element.search.contact`, with a create.
- It makes no list of its own: no probabilitySearch, nothing of the old shell's list search (goal/G40.8).
- `create(container, options)` appends its root to its container and answers it; on a bare page it requires the contact
  list and the contact family's cache, then draws the list into its root.
- The dropdown (the default) is the list in its dropdown face, `options.placeholder` and `options.all` handed on; the pane
  (`face: 'pane'`) is the same list in its pane face, filling its box.
- An ID table is handed on whole: `options.table`, `key`, `label` and `data`.
- `options.filters` (the caller's hidden filters) and `options.statuses` (the mark column) are handed on.
- A pane's press picks: the list is handed `details: null`, unless `options.details` opens something itself.
- `root.value` is the picked key and `root.row` the picked row, `''` and `null` while none is; a pick fires one bubbling
  `change`; None picked clears them.
- `root.refresh()` asks the list again; `root.mark(key, status)` is the list's mark, and a mark said before the list is
  here is said to it once it is.
- `root.destroy()` lets its list go and takes the root out of its container; a picker destroyed before its list is here
  draws none.

## What its test must try to break

- A second list made beside the contact list.
- An option dropped on the way: the table, the filters, the statuses, the words.
- A pane that opens a contact instead of picking it, when its caller only picks.
- A mark lost because it came before the list.
- A list drawn after destroy.
