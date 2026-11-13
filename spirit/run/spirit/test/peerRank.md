# spirit/peerRank.js — its own test

The peer search's one ranker, on the probability modules (goal/G29.17): *"Each relay ranks its members with the
probability modules and answers a capped list. The node merges the relays' answers with the same modules."* So one name
scores the same wherever it is ranked. Owed since the rule *"every production script has its own test"* (goal/G47.1,
box v72). Pure, in process.

- `rank(rows, q, slots)`: `''` or `*` is anyone, every row in the order given; with words, a row that does not match is
  left out and the best match comes first; the whole row as it is served is matched, not its label alone (goal/G41.28,
  Andy: *"search the whole bloody ROW, as it is served"*); equal matches keep the order they came in; the rows come
  back untouched; no rows or a null row is no failure.
- `SLOTS` is 32, the most one relay answers; `slots` caps the list, and `more` says a row was turned away.
- `ranker(q, slots)`: fed a page at a time (goal/G41.30, a long query must not stall the relay), it answers what `rank`
  answers fed once, and keeps the order across slices.

## What its test must try to break

A match on the label alone; a tie broken against the order given; a cap that says no more; a sliced ranker that differs
from the one fed once.
