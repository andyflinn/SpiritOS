# spirit/app/server/script.js — its own test

The spirit.app branch's node work (goal/G49.25, Q5; Andy: *"WHY THE FUCK WOULD IT NOT???"* to *"Does a branch's node work live
at spirit/<branch>/server/script.js, handing its verbs' answers to the scan"*): `verbs(node)`, an answer `{ reply, handler }`
for each verb of `spirit/app/script.js`, over the node's app table; none on a relay. Owed since the rule *"every production
script has its own test"* (goal/G47.1, box v72). The verbs are read from the branch's script; what each answer does is judged
on a scratch node, at its one door, against the verb's own description, `spirit/app/<verb>.json`. The apps asked of are the
node's own, read from its search.

## Requirements

- `spirit.requireScript` of its path hands back `{ verbs }` and nothing else.
- On a node, `verbs(node)` hands an answer for each verb `spirit/app/script.js` declares and for no other, each with its reply,
  an object, and its handler, a function; on a relay (`spirit.IS_RELAY`) none.
- **search** (`search.json`): with no q, `{ ok, items, more }`, each item's label its row as JSON, the row's key the item's; with
  q, fewer apps, the app it names first.
- **label** (`label.json`): sets the label search shows for that app and answers no rows; an empty label goes back to the
  app's own; a key that is no app is refused 404.
- **icon** (`icon.json`): as label, for the icon; a key that is no app is refused.
- **active** (`active.json`): switches an app on and off, in its `node.json` in its state folder and as search shows it, and
  answers no rows; a key that is no app is refused 404; an intrinsic app and one that is only run are refused 409.

## What its test must try to break

- A verb of the branch with no answer, or an answer for a verb the branch does not declare; an answer on a relay.
- An answer that does not do what its description says.
