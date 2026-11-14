# spirit/app/testicle/element/search/suite/listElement.js — its own test

The suite list (goal/G47.1, the UI cycle): the suites of one production file, a view of testicle's suite rows, what
testicle's file detail draws through the suite selector. Owed since the rule *"every production script has its own
test"* (goal/G47.1, box v72). The world of `../../test/testicle.js`: a scratch node with testicle on, the general suites
stubbed, tests set through `testicle.testicle.set` (which makes the suite rows), the list mounted alone on `/face.html`
in a real Chrome.

- `create(container, { script, face, placeholder, all, pick })` loads alone through `spirit.require` and answers
  `{ destroy }`.
- The script's own suite rows (its own test and a general suite), no row of another script, each suite once (the box:
  *"answers that file's suite rows only, each suite once, with its filename and its status"*).
- Columns: 🏃‍♂️ first with no sort, then Suite and Status, each a sort trigger; sorted by suite, ascending.
- A row shows its suite's file and its status, one of *needs running*, *still red*, *green*.
- A row pressed is handed to `pick`.
- With no script, every suite, each once (*"with the script selector blank (all scripts), the suite selector lists every
  suite, each once"*).
- A script with no suite row says *No suite concerns this file.*; a suite row written for it shows by itself.
- A drawn row follows its suite row (box v143, *"subscribe to the data they display"*): a success reported, it shows
  *green* by itself; a failure after it, *still red*, the row drawn once.
- As a dropdown, its placeholder shows in the field.
- `destroy` empties its container.

## What its test must try to break

Another script's suites listed; a general suite listed twice with no script; a list that does not follow the stream; the
options not handed on.
