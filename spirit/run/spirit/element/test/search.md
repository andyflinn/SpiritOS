# spirit/element/search.js

The standard shell list-tool. It keeps every row any search brought, cached by key. It ranks the rows against the words
as they stand, times every filter's test, and lists the best on top without cutting any. With no words, it lists the
rows by a column sort or in arrival order.

- One call on the wire at a time.
- The server's answers only feed the cache.
- It draws a pane, or a dropdown that opens to the same pane.
- It loads on `window.spirit.element.search` (the probabilitySearch; goal/G43.18, Q5). It also sets `window.spirit.matchRanges`, the one marking rule.

It reads `window.spirit.probability` (`probabilityStringObjectMatch`, `createProbabilityBucket`), and nothing else of
the spirit.

**It loads those files itself** (rule/26: every element loads its own parts via spirit.require; nothing is preloaded;
goal/G41.18, found by the shell's general rules on a bare page, where the Apps and Grants lists threw
`createProbabilityBucket is not a function`). Through `spirit.require` it asks for `spirit/probabilityStringMatch.js`,
`spirit/probabilityStringObjectMatch.js` and `spirit/probabilityBucket.js`, and `spirit/element/icon.js` and
`spirit/element/fieldInput.js`. Loaded on a window with nothing
preloaded, whose loader answers in the reverse of the order asked (as a page's fetches may), once its files are in, it
draws and ranks.

## API

- `order(entries, state)` is the pure heart.
  - `entries` is `[{ key, row, at, gone, el }]`.
  - `state` is `{ words, values, filters, sort: { field, direction }, columns, score }`.
  - It returns `[{ key, row, rank, entry }]`.
- `create(container, options)` returns `{ value, row, refresh, redraw, words(), ask(verb, args), sort(field, direction), destroy }`.
  - The options are those its header lists: `server`, `verb`, `search`, `published`, `args`, `columns`, `data`, `element`, `face`,
    `toggle`, `onFace`, `tile`, `visible`, `filters`, `selectors`, `score`, `rows`, `fold`, `details`, `pick`, `empty`,
    `placeholder`, `all`, `name`. A `matched` is not read (goal/G41.28).
- `matchRanges(text, words)` returns `[[from, to), ...]`.

## Requirements of order

- An entry marked `gone` is dropped.
- **Filters**:
  - Each filter's `test(row, values[name])` that answers 0, a negative or not a number drops the row.
  - A positive answer weighs the row, capped at 1.
  - The weights multiply.
  - A filter without `test` is ignored.
- **With words**:
  - The rank is the match times the filters' product, clamped to 0..1, best first.
  - Rows of an equal rank go in arrival order (`at`).
  - A row the words miss stays, last, at 0.
- **What the words are matched against**:
  - `score(row, values)` replaces the match when it answers a value. A null or undefined answer falls back to the match.
  - Otherwise the whole row, as cached in `spirit.data`, its fields not shown too: with columns or without, and a
    `matched(row)` a list hands is not used (goal/G41.28; Andy, box v15: *"All client side searches will be fixed, too,
    and search the whole row, as cached in spirit.data."*).
- **Without words**:
  - With `sort` naming a column that has a `sort`, the rows go by that column, ascending or descending.
    - `text` compares case-insensitively.
    - `number` compares numerically, a non-number reading 0.
    - `date` compares by `Date.parse`.
    - `path` compares folder by folder, so a folder's contents follow it before its next sibling.
  - Equal rows go by `at`.
  - A sort on a column without `sort`, or on no column, keeps arrival order.
  - The rank is the filter product.
- An entry's element row (`el.row`) is read in place of its `row`, for filters, matching, sorting and the answer.

## Requirements of create

- **Drawing**:
  - It draws its search field, its list and its filters into the container.
  - With `rows()` or `data`, it draws at once.
  - Each row is a `tr` with `data-key`, its cells marked by `matchRanges`.
  - With no row to show, it shows `empty`, or "Nothing matches.".
- **Typing**:
  - Re-ranks the cache at once.
  - Asks `server.verb` with `args(words, values)`, or `{ text }` without `args`: through its own data source
    `search(args, verb)` when the mounter hands one, else through the spirit object itself (goal/G43.24; Andy: *"every
    element that accesses ANY api must require them themselves"*): the family on `spirit.ready`, or the one
    `spirit.require(spirit.familyPath(server))` binds, a dotted verb walked as a path into it, answered by
    `spirit.outcome`. It takes no api from its options. With neither a source nor a server and verb it asks nobody.
- **One call on the wire**:
  - While a search is out, more typing sends nothing.
  - When the search returns, one search goes with the words as they then stand.
- **Answers**:
  - An answer's items (`{ key, label: json }`) join the cache, a later one replacing a row with the same key.
  - A failed answer (not status 200, `ok: false`) leaves the cache standing.
- **ask**:
  - `ask(verb, args)` lends the wire. It resolves the answer's body.
  - It rejects a failed one with its error.
- **The page's own rows**:
  - `rows()` or `data` (`spirit.data.rowsOf`) join the cache.
  - A row the page no longer has is gone from the list.
  - With `data`, the answers are seated into it, and its watch redraws.
- **Headers**:
  - A header of a column with `sort` is a sort trigger while the field is empty: pressed, ascending; pressed again,
    descending.
  - `sort(field, direction)` does the same, and `sort()` clears it.
- **Filter buttons**:
  - A toggle flips true and false.
  - A multi choice is pressed off and on.
  - A keepOne multi filter (goal/G47.1, the testicle search's red and green): a choice goes off while another is on; the
    last choice still on, pressed, stays on.
  - A plain choice takes its value.
  - Each press re-ranks and asks.
- **Its rows' icons** (goal/G41.26). Andy: *"in probablitySearch, if there is a filter row, it must start wit a '🗜'
  icon, and the search input row must start with a '🔎' icon"*.
  - With filters, the filter row starts with 🗜, its filters after it, and keeps it when a press redraws them.
  - The search row starts with 🔎, right before its input, with filters or without.
  - With no filters there is no 🗜.
  - A dropdown's pane alike.
- **The 🪣 row of selectors** (goal/G41.26). Andy: *"so the client probabilitySearch needs to provide a selectorRow, on
  top of the filter row. the selectorRow must start with a\n🪣icon, and be hidden, if no selectors are present."*,
  *"any searchSelector in our system must go into the probabilitySearch's selectorRow, so that the user-can see, which elements belong to the search."*, and *"do it for all probabilitySearch object in the new face-shell. go."*
  `selectors: [{ name, element, test(row) }]`, each element a selector its mounter made (cw's shape, under that go).
  - Each element is mounted in one row of the bubble, in the order handed, on top: 🪣 row, then 🗜, then 🔎.
  - The row starts with 🪣. With no selectors there is no 🪣 row.
  - A selector's `change` redraws the list, its test narrowing the rows already fetched, asking nothing; every
    selector's test counts, and one cleared lets its rows back.
  - A dropdown's pane alike.
- **One bubble** (goal/G41.26). Andy: *"the filer row and search-input row must be set in a transparent bubble, with a
  border that has the same color as the type-face"*, *"NO! the filtel row and the search-input row int eh SAME
  bubble"*, drawn as `| 🗜 [filter1] [filter2] ...` over `| 🔎[search-input][search-button]`, and *"if there's no
  filters, there's no filer row."*
  - The filter row and the search row stand in one box, transparent, its border `currentColor`, rounded.
  - The list stands outside it.
  - The search row is 🔎, the input, then the search button.
  - With no filters, no filter row is in it. A dropdown's pane alike.
- **Clear** empties the field.
- **Picking**:
  - A press on a row calls `details(row, key, el)` when given, in a pane.
  - Otherwise it calls `pick(row, key)` and sets `value` and `row`.
  - A press `fold` claims picks nothing.
- **Keys**:
  - The arrow keys, Home and End move the current row.
  - Enter on the list presses it. Enter in the field searches.
- **Dropdown**:
  - The field shows the `all` words, or else the placeholder, until a row is chosen. Then it shows the chosen row's
    name.
  - It opens on a press and shuts on Escape, on a pick, and on a press outside.
  - `all` adds a None button, which picks nothing.
- **element(row, key)** is made once per key and destroyed by `destroy`.
- **published(fn)**, when handed, re-asks each time it calls fn.
- **destroy**:
  - Stops listening to `published`, the data watch, and the outside press.
  - After destroy, nothing draws.
- **matchRanges**:
  - Marks every place each word stands, partial words included, case ignored, in order.
  - A word's regular-expression characters are literal.
  - No words gives `[]`.

## What its test must try to break

- A filter that answers NaN or 2.
- A score above 1 or below 0.
- Equal ranks.
- A gone entry.
- A sort on a column without `sort`.
- Path ordering against plain text.
- Typing while a call is out.
- A failed answer.
- A row the page dropped.
- Enter in the field versus on the list.
- A press inside a row's own action button.
- Regex characters in the words.
- Drawing after destroy.
- A filter row without its 🗜, or a 🗜 with no filters; a search row with anything before its 🔎, or no 🔎; a redraw
  of the filters that drops the 🗜.
- A bubble of another border colour, or not transparent; the two rows in two bubbles; the list inside the bubble.
- A selector not mounted, or out of order, or below the filters; a 🪣 row with no selectors; a change that does not
  redraw, or asks the server.

## Its bubble laid out (once search-bubble.js)

The search element's bubble, in a real browser (goal/G41.26). Its test is the bubble part of `./search.js` (once `./search-bubble.js`); the
element's other tests run in node, the first part of `./search.js`.

Andy, on G41.26: *"why do the icons in the probabilitySearch row have different width's? do they not use the icon
element? I'd like it, if the controls in the search bubble look better aligned."*

Asked of a real browser, since widths and places are layout: `./search-bubble-laid.html`, opened at
`/DEBUG/spirit/element/test/search-bubble-laid.html` on a scratch node with its DEBUG on
(`spirit/test/headLessChrome.js`), a pane and a dropdown, each with a filter.

### Requirements

In a pane and in a dropdown's pane alike:

- **The 🪣 row of selectors on top** (Andy: *"the selectorRow must start with a\n🪣icon"*): its 🪣 the icon element
  too, a square of its font size, over the 🗜; its first selector starting where the search input does.
- **The row icons are the icon element** (`spirit/element/icon.js`): 🗜 and 🔎 are spans of class `shell-icon`.
- **Each icon is a square of its font size**, whatever its glyph. A bare glyph takes its own width, which differs
  from glyph to glyph and from browser to browser.
- **The icons stand one under the other**, as wide as each other.
- **Each row's first control starts at the same place**: the first filter over the search input.

### What its test must try to break

- 🗜 or 🔎 drawn as a bare glyph: its class, and its width that is not its font size (here 20px at 16px).
- The rows' first controls at different places.

## The search elements in spirit/element/search/ (once search-folder.js)

goal/G43.18. Its test is the folder part of `./search.js` (once `./search-folder.js`): the tree read as it is, what is there, what is gone and what the code names, and each file loaded on a page. That nothing else changed (*"No behaviour or function changes: renaming only"*) is judged by the moved elements' own suites, moved with them.

Andy: *"all "probabilitySearch" elements follow the EXACT SAME PATTERN."*

### Requirements

- There: `spirit/element/search.js`; under `spirit/element/search/`:
  - `api.js` and `api/verb.js`: *"appServerSelector.js is today's api search in dropdown mode: it becomes search/api.js"*, *"apiFamilySelector.js ... folds into search/api.js"*, *"apiVerbSelector.js is the verb dropdown filter: search/api/verb.js"*.
  - `app.js` and `app/rowElement.js`, from `spirit/app/appSelector/listElement.js` and `rowElement.js`.
  - `contact.js`, `contact/listElement.js`, `contact/rowElement.js`; the same for `icon`, `bundle` and `branch`.
  - `file.js` and `file/rowElement.js`, `grant.js` and `grant/rowElement.js`: *"their listElement becomes search/file.js and search/grant.js, their rowElement stays in the folder."*
  - `valued.js`.
  - `contact/detailElement.js`, Andy: *"contactDetails.js should really be spirit/run/spirit/element/search/contact/detailElement.js"*; and `contact/relayPanel.js`, Andy: *"spirit/run/spirit/element/relayPanel.js really should be  spirit/run/spirit/element/search/contact/relayPanel.js"*. Gone: `contactDetails/` and `relayPanel.js`.
- Gone: `probabilitySearch.js`, `appServerSelector.js`, `apiFamilySelector.js`, `apiVerbSelector.js`, `contactSelector.js` and `contact/`, `files/`, `iconSelector.js` and `icons/`, `bundleSelector.js` and its folder, `branchSelector.js` and its folder, `grantSelector/`, `valued.js`, and `spirit/app/appSelector/listElement.js` and `rowElement.js`.
- The same pattern for all: every name under `search/` is a word, a to z, and every folder sits beside its `<name>.js`.
- *"The apps and elements that require them name the new paths"*: no code, tests included, comments left out, names an old path.
- *"search/api/verb.js, which branch names too"*: `search/api.js` and branch both load it.
- Renaming only, so what loaded before still loads: in a real Chrome on a scratch node's `face.html`, every file in the list above is required through `spirit.require` and answers within 8 seconds. Folding the family selector into `search/api.js` made it and `search/api/verb.js` require each other, and neither loaded. Andy saw it in the agent: *"the bundles fail to pop into a tab, when i click on a bundle, no network activity, no console activity."*

The app search's server filter, node.mount true and active, hidden by default, is judged in a real Chrome by the app search's own suite, `spirit/element/search/test/app.js`.

## A search dropdown's list floats (once search-popup.js)

goal/G43.18. Its test is the popup part of `./search.js` (once `./search-popup.js`): real clicks and keys in a real Chrome on a scratch node's face page, three search dropdowns of 40 rows, each in a 48 px box that cuts off what overflows it (as a row of a panel does), a block drawn over the space below the first two, and the third low in the window.

Andy: *"is it possible to have a "popup" element, which floats it's contents above all windows, but only one in the whole browser window can be active? only bound by the window size but not neccessarily filling it? all dropdown panels should be part of that"*, then *"and the actual dropdown control stays where it is? just the popped list would "float"? then do that for the lists in the search-dropdown please."*

### Requirements

- Pressed, a dropdown's field stays where it was, in its box.
- Its list reaches past its box, over the block drawn on top, and is what is seen there.
- The list lies inside the window and does not fill it; low in the window too.
- Only one open: pressing a second dropdown closes the first's list. Escape closes it, and so does a press outside.

## The face tiles (once search-tiles.js)

The third face of `spirit/element/search.js` (goal/G43.6). Its test is the tiles part of `./search.js` (once `./search-tiles.js`), in a real browser, with rows of its own. The other faces are the first part's.

Andy, box: *"probabilitySearch gets a third face, 'tiles', beside 'pane' and 'dropdown': the same ranked rows, drawn as tiles. Any list can use it. No column headers or sorting; arrow keys also go left and right."*

### Requirements

- `face: 'tiles'`: one `.app-icon` tile per row, its image from `row.icon` above its label from `row.label`. No table, headers or sort triggers. One search field.
- The tiles are a grid: side by side, never one per line, and still so after words are typed and cleared (goal/G47.1; Andy, after the kept rows: *"the FUCKING TILE MODE IN APP-SEARCH ... IS NO GRID ANYMORE"*).
- With no words there is no bar, and its space stays: with words a tile's label stands where it stood.
- With words the best row comes first, with a bar between image and label, horizontal and centered: `.list-rank` as the lists draw it, the same colour and number.
- A tile the words miss stays, last, with an empty bar. Nothing is cut.
- Arrow keys go left and right as well, and Enter picks where they went. A pressed tile is the list's pick.
- The tooltip shows the row, one `path: value` above the other, drawn from the scan `probabilityStringObjectMatch` uses: `measureObject`, exported, whose rows carry their js object path (`stats.cpu`, `files[0].name`). The `icon` row is dropped.
- A pane stays a table with headers.

### The toggle (goal/G43.9)

- *"A new option, toggle: true. Without it nothing changes for any other list."* No option, no toggle, on a pane or on tiles.
- *"It flips pane and tiles only. Dropdown closes to a field, so it never shows the toggle."*
- *"The toggle sits on the search row, right after the Search button."* It is the next element after that button.
- *"The face can change while the list lives, keeping the search words."* A press draws the other face, words kept, and a second press goes back.
- *"It tells its owner the new face."*

The box names neither, so the test names them for the builder: the toggle is `.list-toggle`, and the owner hears through the option `onFace(face)`. If the build names them otherwise, the verifier corrects the test.

### What a list hands its tiles (goal/G43.17, Q14)

Andy, on Q14 *"May I change the shared search list, so the Files tiles can show each file's own icon and name?"*: *"yes."*

- The option `tile(row, key)` answers `{ icon, label }` for a tile. Either one left out is the row's own `row.icon` or `row.label`; without the option nothing changes for any other list.
- The files list hands a file its kind's icon (fstat's `iconOf`), a folder 📁 shut and 📂 open, and the file's name.

- A grid of tiles (goal/G47.1; Andy: *"the FUCKING TILE MODE IN APP-SEARCH (OR SEARCH ITSELF) FUCKING IS NO GRID ANYMORE, EVERY FUCKING TILE IS CENTERED ON IT'S OWN FUCKING ROW!"*): three tiles in an 800 px box share one line, left to right, each apart from the next.
- The list stays inside its page (goal/G47.1; Andy: *"THE FUCKING LIST IS NOT CONTAINED WITHIN THE FUCKING PAGE, LIKE IT IS SUPPOSED TO, GID OR NO GRID!!!!!!!!!!!!!!"*): forty rows in a 400 by 240 px box, as tiles and as a list: nothing is drawn below the box, and the rows that do not fit scroll inside it.

## The search keeps its rows (goal/G47.1)

The box: *"The search element (spirit/element/search.js) never redraws its list. Each row is made once and kept in the
table: a new record adds its one row at its place; a changed record repaints its own row; a filter or a selector hides
and shows rows; a sort or new words move them"*, *"It is the shared search element, so every search in the face gets
it"*.

In a real Chrome on a scratch node, a list of five rows with a filter, a selector, two sortable columns and a search
field; the page marks each row's `<tr>` as it is first drawn. A sort, and a sort back, move the same five elements; a
new record adds its one row between its neighbours by name, the five others the same elements; a changed record shows
its new text in the same element, every other row the same; a filter and a selector hide rows and show them again,
every element the same and still in the page; typed words put the best match first, the same element, and cleared,
the rows go back. Throughout, the table is the one first drawn, and no row element or table is taken out of the page.

What it must try to break: a list rebuilt from its HTML on any change; a row element made again for a key it already
drew; a hidden row taken out of the page; a new record that redraws its neighbours.
