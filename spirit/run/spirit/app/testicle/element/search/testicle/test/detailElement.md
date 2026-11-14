# spirit/app/testicle/element/search/testicle/detailElement.js — its own test

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
- `destroy` empties its container, and nothing is drawn there after.

## What its test must try to break

The oldest flip first; a shortened title; the current row alone; a history that does not follow the stream; a destroyed
detail that still draws.
