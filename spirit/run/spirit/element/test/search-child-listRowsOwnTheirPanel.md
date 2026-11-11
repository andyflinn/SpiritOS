# search-child-listRowsOwnTheirPanel.js

A list row's panel owns its parts (goal/G43.19). Andy: *"all: cw just did an emergency fix for me, which could be
asserted with a general test spirit/element/test/search-child-listRowsOwnTheirPanel.js"*, and *"wsl? can you please add
such a test now?"*

What cw fixed at 19329f1d: after one item was closed, every other item opened with its title bar alone. Each item's
details were mounted in a layer of their own, a closed layer is hidden and kept, and the details found their parts with
`document.getElementById`, so a second item's mount found the first item's hidden parts and drew there.

    node spirit/element/test/search-child-listRowsOwnTheirPanel.js [file]

**Its name is its reach** (`../../../test/TEST_SYSTEM.md`): a `-child-` test beside `spirit/element/search.js` judges
`search.js` and every module in `spirit/element/search/` and below. Given a file it judges that one, as `testModule.js`
hands it; given none, all of them.

## Requirements

- **An element finds its parts inside its own container, never by id across the page**: in its code, comments left out,
  no `document.getElementById`, `document.querySelector`, `document.querySelectorAll`, or `document.getElementsBy*`
  (class name, tag name, name). A lookup inside a container (`container.querySelector`) is the way.
- Each lookup across the page is named by its file and line in what its one check answers (a test's title is steady:
  no path or line built into it, `../../test/spirit-sibling-titleRules.js`).
- **Never vacuous**: run over the reach, it must have read more than 10 modules; handed a file outside its reach, it is
  red.

## What its test must try to break

- A fallback to `document.getElementById` after a lookup inside the container (`search.js` `el()`).
- A lookup only in a comment, which is no lookup.
- `document.body` or `document.createElement`, which find no part and are not asked.
