# spirit/element/test/search-child-browser.js

The -browser general test beside `spirit/element/search.js` (goal/G47.1, box v121): the page twin of
`search-child-general.js`. A `-child-` test (`../../test/TEST_SYSTEM.md`): it judges `search.js` and `search/` and below.

    node spirit/element/test/search-child-browser.js [<script> ...]

Given scripts, the searches they are of (`search/<name>.js` or a file under `search/<name>/`); given none, or `search.js`
itself, every search. valued is exempt, as in `search-child-general.js` (Andy: *"values doesn't count"*).

## Requirements (goal/G47.1, box v121)

The box: *"new, the page twin of search-child-general.js: every search (selector, listElement, rowElement, detailElement)
mounted in a page on a scratch node, more rows than fit"*. One test per check, over every search judged (goal/G47.2): its
answer names each search breaking it. A search a check has nothing to judge in (no list drawn, no detailElement, a detail
that draws nothing for a planted row) is said as a comment, never counted green; a check no search could be judged by is
red.

How each search is mounted: a scratch node (the tracked files) and a headless Chrome on its face page, a fresh page per
search. The selector is created with `{ face: 'pane', open }` in a pane of a stated size (640 by 420, class fill), over a
panel stack (`spirit/element/panel.js`). The probabilitySearch it makes is watched to learn the spirit.data branch it is a
view of, and 60 rows are planted there, each a copy of a row the branch holds (or the plain text fields alone), every text
field of it, and of its label json, a long value with no place to break. The detail is the search's detailElement, created
in a panel layer as the apps open one, its options the planted row's fields with `row` and `panel` beside them.

1. the list's box has a stated size, from its pane, not its rows (rule 16): with the rows planted, its height is what it
   was, and it ends inside its pane.
2. the list scrolls: the box keeps its size, scrollHeight > clientHeight, and its overflow-y is auto or scroll.
3. scrolling the list, its title and buttons stay at the top: every button and field of the list's host outside the list
   keeps its top when the list is scrolled to its end.
4. a planted long value in a row wraps or clips, nothing past the row's edge: nothing of a planted row is seen past it.
5. the detail keeps a planted long value inside its panel, and scrolls when taller: nothing of it is seen past its
   layer's pane, and what reaches below the pane is inside a box that scrolls.
6. the detail's title bar stays pinned when it scrolls: made far taller than its panel (a 5000 px part at the end of what
   it drew, as the browser general test grows a box), something in its layer scrolls, and scrolled to its end, the
   layer's title bar keeps its top.
7. the selector's dropdown stays inside the window, opened near the right and bottom edges: created with
   `{ face: 'dropdown' }` 4 px from the window's right and bottom, its field pressed, its popup lies inside the window.
8. two details open, one closed: the other still draws in its own panel (G43.19, in a page; `listRowsOwnTheirPanel` in
   `search-child-general.md`): a planted row's detail opened and closed, another's opened, the second draws in its own
   pane and the closed one's pane is left as it was.

Input length is checked once, in `spirit/test/spirit-sibling-browser.js`, not here.
