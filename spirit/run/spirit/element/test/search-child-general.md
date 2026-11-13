# spirit/element/test/search-child-general.js

The -general general test beside `spirit/element/search.js` (goal/G47.1, box v94, 2: *"existing general tests fold into the
appropriate of the 3 new general test name-formats"*). Its parts, each the test it was, every title kept, both read from
the files: folderRules, listRowsOwnTheirPanel.

    node spirit/element/test/search-child-general.js [<script> ...]

No argument, each part judges all it applies to; each argument, that one, its results reported for it.

## folderRules (was search-child-folderRules.js)

A `-child-` general test beside `spirit/element/search.js` (`../../test/TEST_SYSTEM.md`): it judges `search.js` and
`search/` and below. Given a file, it judges the search that file belongs to; given none, every search. Judged on disc,
from the files and their code with comments left out.

goal/G43.32. Andy: *"cw, we certainly want, in this item, uniformity, in the search elements and their folders, contain
list, row an detail elements."*, *"all the others should adhere to the directory structure, as implied by MANY design
decisions."* valued is exempt: *"values doesn't count"*, *"no need to fix valued in this item, it's kind of deprecated
already."*

### Requirements

- A search is a `.js` in `spirit/element/search/` or a folder there holding scripts; `test/` and valued are none.
- The job branch has its search, `spirit/element/search/job.js`; `spirit/element/job.js` and `jobDetail.js` are gone
  from `spirit/element/` (the box: *"The job search is made from spirit/element/job.js and jobDetail.js."*).
- For each search `<name>`:
  - `search/<name>.js` is the selector, an element placing a create through installSpiritElement by its own path.
  - `search/<name>/listElement.js`, `rowElement.js` and `detailElement.js` are there, each an element placed by its path.
    Branch and icon have no detail: none is ever opened (Andy: *"branch and icon: if no details are ever openened, there
    needs to be now detail panel."*).
    Nor has suite, testicle's suite search: a suite row opens nothing in the file detail (goal/G47.1, the UI cycle).
  - The selector requires its own `listElement.js` and draws it (`search.<name>.listElement.create`), in its dropdown and in
    its pane, and makes no list of its own: no probabilitySearch, no rows (Andy: *"all, any search-unit has ONE list shared
    by popup and list modes."*).

- A list's panels stand in its search (Andy: *"if a detail panel is used for a list it should reside in that lists
  search-system"*, *"it means that grant and relay \"panels\" move to their spot in the search-element-tree."*):
  - no list's panel or detail (`*Panel.js`, `*Detail.js`, `*Details.js`) stands in `spirit/element/` beside the searches;
    `panel.js`, the generic stack, is no list's;
  - the grants panel is `search/grant/grantsPanel.js`, placed by its path;
  - one detail for every kind of contact (*"the contact list already knows the difference between contact types. so should
    the detail panel."*): `search/contact/relayPanel.js` is gone into `contact/detailElement.js`, and a contact row opens
    the contact detail alone.

### What its test must try to break

- A search whose list is its selector file (`search/<name>.js` holding the list), or whose folder lacks a list, a row
  or a detail.
- A selector beside a list it does not draw.
- The job list or its detail left in `spirit/element/`.
- A part present but not placed by its own path.
- A panel or detail of a list left in `spirit/element/`, the grants panel outside the grant search, or a second contact
  detail beside the one.

What each element does on a page is judged by `spirit/test/spirit-sibling-browser.js`.

## listRowsOwnTheirPanel (was search-child-listRowsOwnTheirPanel.js)

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

### Requirements

- **An element finds its parts inside its own container, never by id across the page**: in its code, comments left out,
  no `document.getElementById`, `document.querySelector`, `document.querySelectorAll`, or `document.getElementsBy*`
  (class name, tag name, name). A lookup inside a container (`container.querySelector`) is the way.
- Each lookup across the page is named by its file and line in what its one check answers (a test's title is steady:
  no path or line built into it, `../../test/spirit-sibling-general.js (titleRules)`).
- **Never vacuous**: run over the reach, it must have read more than 10 modules; handed a file outside its reach, it is
  red.

### What its test must try to break

- A fallback to `document.getElementById` after a lookup inside the container (`search.js` `el()`).
- A lookup only in a comment, which is no lookup.
- `document.body` or `document.createElement`, which find no part and are not asked.
