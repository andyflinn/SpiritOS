# spirit/element/test/search-child-folderRules.js, every search the same shape

A `-child-` general test beside `spirit/element/search.js` (`../../test/TEST_SYSTEM.md`): it judges `search.js` and
`search/` and below. Given a file, it judges the search that file belongs to; given none, every search. Judged on disc,
from the files and their code with comments left out.

goal/G43.32. Andy: *"cw, we certainly want, in this item, uniformity, in the search elements and their folders, contain
list, row an detail elements."*, *"all the others should adhere to the directory structure, as implied by MANY design
decisions."* valued is exempt: *"values doesn't count"*, *"no need to fix valued in this item, it's kind of deprecated
already."*

## Requirements

- A search is a `.js` in `spirit/element/search/` or a folder there holding scripts; `test/` and valued are none.
- The job branch has its search, `spirit/element/search/job.js`; `spirit/element/job.js` and `jobDetail.js` are gone
  from `spirit/element/` (the box: *"The job search is made from spirit/element/job.js and jobDetail.js."*).
- For each search `<name>`:
  - `search/<name>.js` is the selector, an element placing a create through installSpiritElement by its own path.
  - `search/<name>/listElement.js`, `rowElement.js` and `detailElement.js` are there, each an element placed by its path.
  - The selector requires its own `listElement.js`: it draws that list, and is never a second one.

## What its test must try to break

- A search whose list is its selector file (`search/<name>.js` holding the list), or whose folder lacks a list, a row
  or a detail.
- A selector beside a list it does not draw.
- The job list or its detail left in `spirit/element/`.
- A part present but not placed by its own path.

What each element does on a page is judged by `spirit/test/spirit-sibling-generalRules.js`.
