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
- *"The testicle search's default equals testicle.red: all scripts, all suites, reds only, most severe first"* (Andy:
  *"the default setting for testicle search should be EQUAL the the RED verb of testicle."*; and earlier, *"the empty
  search string with no script or suite selected should already fill up with more that 20 reds when i open the app!, and
  typing in the search bar sends requests and returns NOTHING$!"*). The red and green choice, the script and the suite go
  to the server with the words, so it narrows before it cuts; one answer holds about 12 tests, so the list asks for the
  following ones while the server says there are more, up to 100.

## What its test does

A scratch node with testicle on; two planted scripts with their own tests; through `testicle.testicle.set` a passing test
of alpha at severity 0 with a long title, a failing test of beta at 1, and a test of alpha in a general suite set passing,
then failing at 0.2, so two of its rows are kept; and 30 failing tests of gamma, a third planted script in a folder of its
own, more than one answer holds. The search mounted alone in Chrome on `/face.html`, after all of them were set.

- The module and its folder's two parts are there; it loads the file search.
- It lists each test once, by its current row.
- Opened, red is on and green off; it shows all 30 of gamma's reds, reds only, the most severe first. Then green is
  pressed, and the checks below see both. Typed words, one of gamma's titles, show that test first.
- Five columns per row: ❌ or ✅; `0.00`, `1.00`, `0.20`; the long title in full, not clipped; `alpha.js`, `beta.js`; the
  suite's file name; the script's and the suite's full name as the cell's tooltip.
- Five headers, each a sort trigger; a press sorts by its column, a second press the other way.
- red and green both on once green was pressed; red off shows the successes alone, and then a press on green leaves it on; green off
  shows the failures alone, and then a press on red leaves it on.
- Two dropdown selectors, script first. With no script chosen every script's tests show and the suite selector offers every
  suite. The script selector lists production scripts only; a script chosen narrows the rows; its suites are listed in the
  suite selector, and a suite chosen narrows them; None unselects each again.
- A test set on the node shows in the list with no press.
- destroy leaves its container empty.
- The search fix (goal/G47.1, the box: *"Every test search answers its failed tests first, then by severity"*, *"the page
  asks for the following answers while the server says there are more, up to 100 tests"*, *"Opened with no words and no
  selector, the page shows the reds first, more than 20 when there are; typed words show the tests they find"*): 110
  passing tests of beta at 1, 25 failing tests of alpha at 0.3 and alpha's quiet pass (quokka) at 0 are set, and a fresh
  page opens the search. With gamma's 30 failures, opened, the 57 reds alone, the most severe first (the default equals testicle.red); green pressed, the reds
  first, 100 of the 171 shown, the quiet pass not among them. Green off
  shows the 57 failures alone; red off shows 100 successes alone; alpha chosen, or alpha's suite chosen with no script,
  green alone, shows the quiet pass; typed "quokka" shows it, typed "fails" shows failures; the words cleared, the reds
  show first again, 100 in all.

## What its test must try to break

A closed row's old flips listed beside its current row; a column out of order, a severity as `0` or `1`, a path in the
script or suite column, a clipped title, a header that does not sort; both filters off; a selector that lists a test file or
a non-script, a suite offered with no script chosen, a pick that does not narrow, a None that does not widen again; a list
that misses a test written after it drew; reds cut away by greens of a higher severity; a first answer of greens that hides every red; red and green filtered
on the page alone, among the rows one answer held; a page that stops at one answer, or goes past 100; a script, a suite or
typed words that do not ask the server again.
