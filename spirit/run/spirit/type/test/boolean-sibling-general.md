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

What one type accepts and refuses beyond that is judged in its own test, `./<name>.js` beside it.
