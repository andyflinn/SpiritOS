# spirit/owner/server/script.js — its own test

The owner branch's node work (goal/G49.25, Q5; Andy: *"WHY THE FUCK WOULD IT NOT???"* to *"Does a branch's node work live at
spirit/<branch>/server/script.js, handing its verbs' answers to the scan"*): `verbs(node)`, an answer `{ request, reply, handler }`
for each verb of the old-shape branch's `spirit/owner/api.js`, over the owner's boxes and the puppet command's sender, mounted
under its own word, owner; none on a relay. Owed since the rule *"every production script has its own test"* (goal/G47.1, box
v72). What each answer does is judged on a scratch node, at its one door, against the verb's own description,
`spirit/owner/<verb>.json`. The puppet is a key made by the test.

## Requirements

- `spirit.requireScript` of its path hands back `{ verbs }` and nothing else.
- On a node, `verbs(node)` hands an answer for each verb `spirit/owner/api.js` declares and for no other, each with its request
  and its reply, objects, and its handler, a function; on a relay (`spirit.IS_RELAY`) none.
- **boxSearch** (`boxSearch.json`): the boxes reported as `{ ok, items, more }`, none on a new node, with no q and with `*`.
- **boxGet** (`boxGet.json`): a fingerprint no box has is 404.
- **command** (`command.json`): refused 400 without a puppet or without a command, and 503 to a puppet no relay can reach.

## What its test must try to break

- A verb of the branch with no answer, or an answer for a verb the branch does not declare; an answer on a relay.
- An answer that does not do what its description says.

## Known

- No process reports a box today (`spirit/fuckingGarbage/boxes.js`), so a box found, and a puppet's answer, are not tried here.
