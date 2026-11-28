# spirit/branch/server/script.js — its own test

The spirit.branch branch's node work (goal/G49.25, Q5; Andy: *"WHY THE FUCK WOULD IT NOT???"* to *"Does a branch's node work
live at spirit/<branch>/server/script.js, handing its verbs' answers to the scan"*): `verbs(node)`, an answer `{ reply, handler }`
for each verb of `spirit/branch/script.js`, over the owner's allow-table (`spirit/grant/auth/script.js`), one operation per verb;
none on a relay. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The verbs are read
from the branch's script; what each answer does is judged on a scratch node, at its one door, against the verb's own
description, `spirit/branch/<verb>.json`. The branches it puts in a bundle are read from the scripts that declare them.

## Requirements

- `spirit.requireScript` of its path hands back `{ verbs }` and nothing else.
- On a node, `verbs(node)` hands an answer for each verb `spirit/branch/script.js` declares and for no other, each with its
  reply, an object, and its handler, a function; on a relay (`spirit.IS_RELAY`) none.
- **add** (`add.json`): a branch and one verb the node serves into a node-owned bundle (made by `spirit.bundle.add`) answers
  `{ id }`; with no verb the whole branch, its verb `''`. Refused: the same branch and verb again (409 already-in-bundle), a
  bundle not there (no-such-bundle), a branch or a verb the node does not serve. A spirit.fs verb is taken as any served verb (goal/G49.25; Andy: *"the only
  thing i'd hard-code protect from is ownership change"*, *"they go now"*).
- **get** (`get.json`): the row by its number, `{ id, bundle, family, verb }`; a number not held is no-such-branch.
- **search** (`search.json`): `{ items, more }`, narrowed by bundle to that bundle's rows, each label the row as get shows it;
  narrowed by family to that family's alone; by text, the row its words name first.
- **delete** (`delete.json`): that row alone, `{ id }`, get then refusing it and the other row kept; a number not held is
  no-such-branch.

## What its test must try to break

- A verb of the branch with no answer, or an answer for a verb the branch does not declare; an answer on a relay.
- An answer that does not do what its description says; a spirit.fs verb refused (goal/G49.25).
