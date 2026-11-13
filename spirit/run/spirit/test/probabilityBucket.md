# spirit/probabilityBucket.js — its own test

The best objects by probability, seated as they come and serialized to a byte ceiling (goal/G18.4, the third of the
probabilit* modules). Andy, 2026-10-12: *"the ONLY job of probabilityBucket is inserting by highest-probability at the
top, and limiting the serialized object"*. Owed since the rule *"every production script has its own test"* (goal/G47.1,
box v72). Pure, so each test makes its own bucket in process.

- `seatFor`: highest first whatever the arrival order; an equal one behind those already in; the bucket fills with
  probability 0 until higher ones push them out; full, a lower or equal one is turned away (`false`), a higher one takes
  the lowest seat; no seat for a probability outside 0 to 1 or not a number, nor in a bucket of no capacity; any object,
  the bucket knows nothing of strings.
- `serialize(map, maxBytes)`: the object portion only, through `map`; `bytes` the UTF-8 length of the items as JSON;
  the ceiling in bytes, stopping at the first that will not fit, never skipping to a smaller one; 0 or left out is
  unbounded (goal/G27.14); `more` when something was turned away or pushed out, `truncated` only when cut.
- `sort(compare)` (goal/G27.14): every held object re-scored, highest first, equal ones keeping their place; one scored
  outside 0 to 1 stays held but out of `serialize` until scored again; no function, no change.
- In a page alike: loaded as a plain script it is on `window.spirit.probability`, beside what was there, and leaks no
  name.

## What its test must try to break

A tie seated ahead of the earlier one; the ceiling measured in characters; a too-big object skipped for a smaller one
further down; `more` forgetting what was turned away; `sort` shuffling equal scores or dropping a badly scored object.
