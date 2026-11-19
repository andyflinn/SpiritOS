# spirit/app/testicle/element/search/testicle/detail.js — its own test

One test's detail (goal/G47.1, the search cycle): its history of flips, what testicle's face shows in a closable tab when a
test row is clicked. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The world
of `../../test/testicle.js`: a scratch node with testicle on, a test flipped three times through `testicle.testicle.set`,
the detail mounted alone on `/face.html` in a real Chrome.

- `create(container, { script, suite, test })` loads alone through `spirit.require` and answers `{ destroy }`.
- The title line is the test's title in full.
- Its columns: Flipped, then Result, Severity, Title, Script, Suite.
- Every row of the test, current or not, the newest flip first (the box: *"given a valid test title ... it answers every
  row matching that script, suite and title, current or not, newest first"*); no row of another test.
- Each row drawn by the test row (❌/✅, two decimals, file names) with the date it flipped.
- A flip set on the node shows at the top with no press; a test with no row says *No row of this test.*
- Its full script and suite paths and its run button, asking `testicle.run` for them, stand in a row form whose icon is the
  🏃 (a pictograph only in the icon element, the general rules); right under it a second
  row form holds the title in an input bounded by the description rule, 128 bytes (goal/G47.4, the box: *"a second rowForm
  will allow me to change the tests title"*). Its rename asks `testicle.title` with the script, the suite, the old title
  and the typed one; a refusal is said below the forms and the title line stays.
- `destroy` empties its container, and nothing is drawn there after.

## What its test must try to break

The oldest flip first; a shortened title; the current row alone; a history that does not follow the stream; a destroyed
detail that still draws; a title input that takes more than 128 bytes; a rename that asks without the old title; a refusal
nobody sees.
