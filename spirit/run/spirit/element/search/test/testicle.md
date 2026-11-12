# spirit/element/search/testicle.js — the testicle search

goal/G47.1, the cycle "the testicle search". testicle's list of tests: the standard search (`spirit/element/search.js`) over
`testicle.testicle.search`, a view of the testicle branch `spirit/app/testicle/data.js` keeps, the current rows shown. Its
folder `spirit/element/search/testicle/` holds its `rowElement.js` and its `detailElement.js`. testicle's face mounts it in
the first, non-closable tab of its centre pane (`spirit/app/testicle/test/element.js` judges that, and the detail a test row
opens).

## Its requirements (the box)

- *"The search has a script selector, unselected (all) the default."* The script selector is the file search
  (`spirit/element/search/file.js`) as a dropdown, production scripts only.
- *"The search has a suite selector, unselected (all) the default."* *"With the script selector blank (all scripts),
  the suite selector lists every suite, each once ... a suite chosen with the script blank shows every test of that suite,
  whichever script it ran for."* The suites of every script are listed; a suite of two scripts is listed once; chosen, its
  tests of both scripts show; unselected, every suite shows again.
- *"The search has two filters, red and green; at least one of the two is selected at all times: the only combination
  forbidden is both off."*
- *"The columns, in this order: the result first, as an icon, ❌ for a failure, ✅ for a success; severity second; the title
  third; then the script name (no path), then the suite name (no path)."*
- *"The test row also shows its severity, two decimal places, even for 0 and 1 (0.00, 1.00)."*
- *"The script column and the suite column show the file name only, no path; hovering over a script or a suite shows its
  full name as a tooltip."* *"The test title is shown in full."*
- *"The list is sortable by all its columns."*

## What its test does

A scratch node with testicle on; two planted scripts with their own tests; through `testicle.testicle.set` a passing test
of alpha at severity 0 with a long title, a failing test of beta at 1, and a test of alpha in a general suite set passing,
then failing at 0.2, so two of its rows are kept. The search mounted alone in Chrome on `/face.html`.

- The module and its folder's two parts are there; it loads the file search.
- It lists each test once, by its current row.
- Five columns per row: ❌ or ✅; `0.00`, `1.00`, `0.20`; the long title in full, not clipped; `alpha.js`, `beta.js`; the
  suite's file name; the script's and the suite's full name as the cell's tooltip.
- Five headers, each a sort trigger; a press sorts by its column, a second press the other way.
- red and green both on at the start; red off shows the successes alone, and then a press on green leaves it on; green off
  shows the failures alone, and then a press on red leaves it on.
- Two dropdown selectors, script first. With no script chosen every script's tests show and the suite selector offers no
  suite. The script selector lists production scripts only; a script chosen narrows the rows; its suites are listed in the
  suite selector, and a suite chosen narrows them; None unselects each again.
- A test set on the node shows in the list with no press.
- destroy leaves its container empty.

## What its test must try to break

A closed row's old flips listed beside its current row; a column out of order, a severity as `0` or `1`, a path in the
script or suite column, a clipped title, a header that does not sort; both filters off; a selector that lists a test file or
a non-script, a suite offered with no script chosen, a pick that does not narrow, a None that does not widen again; a list
that misses a test written after it drew.
