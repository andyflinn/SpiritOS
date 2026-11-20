# spirit/type/test/boolean-sibling-general.js

The rules every type file keeps (goal/G48.4). A `-sibling-` general test beside `spirit/type/boolean.js`: it judges every
module in `spirit/type/` and below (`../../test/TEST_SYSTEM.md`; Andy: *"spirit/type/test/boolean-sibling-general.js (is
that a name that reaches all type files?)"*). Given a file, it judges that type file; given none, every one.

## What it judges

- Every type file is an object holding `defaultValue`, `isValid` and `ruleDescription` (the box: *"a type script.js is an object containing
  static functions"*).
- `isValid` answers true for the file's own `defaultValue()` (Andy: *"isValid() must return true for default() value of
  the same field script."*).
- `isValid` throws an error for `null` and for `undefined` (Andy: *"isValid(value) must throw an error if the value is null
  or undefined"*).
- `ruleDescription()` answers a short description of what `isValid` checks, a description of 1 to 128 bytes as
  `spirit.type.string.description` takes it (box v23: *"the third filed is ruleDesription(), it returns a short description
  if what the isValid() checks."*).

- **A `<type>Select.js`** (goal/G48.4; Andy: *"every <type>Select.js requires its <type>.js and takes "" plus whatever
  <type>.js"*, *"FIRST checks for "", and returns true if the value is "", it otherwise it lets <type>.js handle the
  check"*, *"has it's own ruleDescription() and defaultValue() which is usually ""*): the search and file filters are
  `descriptionSelect.js` and `fileSelect.js` (Q22: *"get rid of spirit.type.string.line"*, *"description, 128 bytes for a
  search string is plenty"*: `line.js` and `lineSelect.js` are gone, and no script of the tree names either); each select has its `<type>.js` beside it and requires it, takes `""` with `""` its
  default, takes its sibling's own default and throws where its sibling throws (a number, an object, true), and has a
  `ruleDescription()` of its own.

What one type accepts and refuses beyond that is judged in its own test, `./<name>.js` beside it.
