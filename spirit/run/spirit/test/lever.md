# spirit/lever.js — its own test

One gauge: what a relay's bound is, where it stands, which end is the bad one. Since cycle 8 it cannot move (Andy:
*"relay will self-manage within fixed/constant limits. i agree."*): described once at boot, only read after. Owed
since the rule *"every production script has its own test"* (goal/G47.1, box v72). Pure, in process.

- `make`: label, value, floor, ceiling, worseAt; frozen, no setter; value defaults to the floor; worseAt other than
  `floor` or `ceiling` is null. Refuses, never corrects: a label off `fieldRules.leverOk`, a floor or ceiling that is
  no integer, an inverted range, a value outside it.
- `readOut`: the old field names kept, `settable` false, `locked` false, `lastMove` null; a fresh object each time.
- `fromReport`: answers the report read out; a report claiming settable, locked or a lastMove is drawn fixed; null for
  no object, a bad label, a range of no integers, an inverted range, a value outside; no integer value draws the floor.

## What its test must try to break

A gauge that can be moved after boot (a governor growing back); a report that lets the node draw a lever as settable;
a bad range corrected instead of refused.
