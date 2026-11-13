# spirit/element/search/testicle/listElement.js — its own test

The testicle list (goal/G47.1, the search cycle): every current test row of testicle's test table, the probability search
over the testicle branch testicle's cache manager keeps, with a script selector (the file search as a dropdown) and a
suite selector (`../suite.js`). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72).
The world of `../../test/testicle.js`: a scratch node with testicle on, the general suites stubbed, tests set through
`testicle.testicle.set`, the list mounted alone on `/face.html` in a real Chrome.

- `create(container, { pick })` loads alone through `spirit.require` and answers `{ destroy }`.
- Opened, red on and green off, the reds of every script shown, the most severe first (Andy: *"the default setting for
  testicle search should be EQUAL the the RED verb of testicle."*).
- Each test once, by its current row: also after a flip streamed in while the list is open.
- Five columns in order, result, severity, title, script, suite, each a sort trigger; a row shows ❌/✅, two decimals,
  the title, and the script and suite by file name.
- Red and green: one alone shows its kind; both off is refused.
- Two selectors, script first, each a dropdown showing all; the script selector lists production scripts only; a script
  chosen narrows the rows and the suite selector to it; with no script, a suite of two scripts is listed once and, chosen,
  shows its tests of both.
- A row pressed is handed to `pick`; a test set on the node shows with no press.
- With words typed and green alone, it asks answer after answer while the server says more, with green sent, and stops
  at 100 tests.
- `destroy` empties its container.

## What its test must try to break

Green on at the start; the replaced row of a flip drawn beside the current one; both filters off; a selector that does
not narrow; asking on past 100 tests, or never past the first answer.
