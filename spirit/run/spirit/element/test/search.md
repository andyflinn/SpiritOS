# spirit/element/search.js

The standard shell list-tool. It keeps every row any search brought, cached by key. It ranks the rows against the words
as they stand, times every filter's test, and lists the best on top without cutting any. With no words, it lists the
rows by a column sort or in arrival order.

- One call on the wire at a time.
- The server's answers only feed the cache.
- It draws a pane, or a dropdown that opens to the same pane.
- It loads on `window.spirit.element.probabilitySearch`. It also sets `window.spirit.matchRanges`, the one marking rule.

It reads `window.spirit.probability` (`probabilityStringObjectMatch`, `createProbabilityBucket`), and nothing else of
the spirit.

**It loads those files itself** (rule/26: every element loads its own parts via spirit.require; nothing is preloaded;
goal/G41.18, found by the shell's general rules on a bare page, where the Apps and Grants lists threw
`createProbabilityBucket is not a function`). Through `spirit.require` it asks for `spirit/probabilityStringMatch.js`,
`spirit/probabilityStringObjectMatch.js` and `spirit/probabilityBucket.js`. Loaded on a window with nothing
preloaded, whose loader answers in the reverse of the order asked (as a page's fetches may), once its files are in, it
draws and ranks.

## API

- `order(entries, state)` is the pure heart.
  - `entries` is `[{ key, row, at, gone, el }]`.
  - `state` is `{ words, values, filters, sort: { field, direction }, columns, matched, score }`.
  - It returns `[{ key, row, rank, entry }]`.
- `create(container, options)` returns `{ value, row, refresh, redraw, words(), ask(verb, args), sort(field, direction), destroy }`.
  - The options are those its header lists: `api`, `server`, `verb`, `args`, `columns`, `data`, `element`, `face`,
    `filters`, `matched`, `score`, `rows`, `fold`, `details`, `pick`, `empty`, `placeholder`, `all`, `name`.
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
  - Asks the server `api.verb(server + '.' + verb, args(words, values))`, or `{ text }` without `args`.
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
- **onPublished** re-asks.
- **destroy**:
  - Stops listening to `onPublished`, the data watch, and the outside press.
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
