# spirit/element/search/api/rowElement.js, one family as a row

The api search's row (goal/G43.32; Andy: *"uniformity, in the search elements and their folders, contain list, row an
detail elements."*): one family of an api tree in the family list (`../listElement.js`), its one field the family's name,
the name column that list drew before. Its test is `./rowElement.js`: the browser file run in node on a bare window, the
shared row element a stand-in that keeps the spec it is handed.

`spirit.element.spirit.element.search.api.rowElement.create({ name })`.

## Requirements

- It places itself at `spirit.element.spirit.element.search.api.rowElement`, with a create, and loads the shared row
  element itself.
- A row is of kind `family`, keyed and named by the family (by its key when handed only that), with no actions.
- Its one field is `name`; what it paints is escaped.
- Its rows share one index. A tree read again replaces the list's rows whole, so a row has no dispatch.

## What its test must try to break

- A row keyed by anything but the family's name.
- A second field, or an action.
- Unescaped text.
