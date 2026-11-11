# spirit-sibling-searchRules.js

The search rule of a module (goal/G41.28), judged in its code. It runs once per file, the file its argument, as
`./spirit-child-generalRules.js` does:

    node spirit/test/spirit-sibling-searchRules.js spirit/app/desk/desk.js

**Its name is its reach** (`./TEST_SYSTEM.md`): a `-sibling-` test beside `spirit.js` judges every module in
`spirit/run/` and below, a server and a page alike, with its own test or without (goal/G47.1). Given no file, it judges every module
`testModule.js` gives it, each its own check, named by its path.

`spirit.js` has been at `spirit/run/spirit/spirit.js` since goal/G43.18; `testModule.js` finds it there for the run
root's test folder (`./TEST_SYSTEM.md`), so this file is a general test, run once per module it judges.

Andy, box v15: *"the ServerSide of probability Search is NOT searching the whole row of the object."*, *"a probability
search of a dataBase table must ALWAYS search the whole bloody ROW, as it is served through a single-row "get", using
a probabilityStringObjectMatch."*

## Requirements

- **It hands every search the row whole**: in its code, comments left out, no call of `probabilityStringObjectMatch`
  hands it an object literal, `{ id, title, box }`, the fields picked on the spot. Each call that does is named by its
  line.

What a module builds by hand before the call (a `flat` copy of some fields) is not seen here; a table's own test asks
that a word in any field its get serves finds the row (`spirit/app/agent/table/test/rowTable.md`).

## What its test must try to break

- An object literal of picked fields handed to `probabilityStringObjectMatch`, on one line or over several.
- A comment that names such a call counted as one.
