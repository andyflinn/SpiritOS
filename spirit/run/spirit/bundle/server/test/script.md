# spirit/bundle/server/script.js — its own test

The spirit.bundle branch's node work (goal/G49.25, Q5; Andy: *"WHY THE FUCK WOULD IT NOT???"* to *"Does a branch's node work
live at spirit/<branch>/server/script.js, handing its verbs' answers to the scan"*): `verbs(node)`, an answer `{ reply, handler }`
for each verb of `spirit/bundle/script.js`, over the owner's allow-table (`spirit/grant/auth/script.js`), one operation per verb;
none on a relay. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The verbs are read
from the branch's script; what each answer does is judged on a scratch node, at its one door, against the verb's own
description, `spirit/bundle/<verb>.json`. The app server it names is read from the node's app search.

## Requirements

- `spirit.requireScript` of its path hands back `{ verbs }` and nothing else.
- On a node, `verbs(node)` hands an answer for each verb `spirit/bundle/script.js` declares and for no other, each with its
  reply, an object, and its handler, a function; on a relay (`spirit.IS_RELAY`) none.
- **add** (`add.json`): a node-owned bundle, `{ id }`. Refused: a label one of node's bundles has (label-taken), an empty label,
  and an owner naming an app server (not-node-owned); an owner that is no owner is read as node.
- **get** (`get.json`): the bundle by its number, `{ id, label, owner }`; a number not held is no-such-bundle.
- **search** (`search.json`): with no words every bundle, `{ items, more }`, each label the bundle as get shows it; by text the
  bundle its words name first; an owner narrows it to that owner's bundles.
- **delete** (`delete.json`): the bundle and every branch row naming it (`spirit.branch.add`, `spirit.branch.get`), `{ id }`, the
  other bundle kept; a number not held is no-such-bundle.

## What its test must try to break

- A verb of the branch with no answer, or an answer for a verb the branch does not declare; an answer on a relay.
- An answer that does not do what its description says; a branch row left naming a deleted bundle.
