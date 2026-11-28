# spirit/peer/server/script.js — its own test

The peer branch's node work (goal/G49.25, Q5; Andy: *"WHY THE FUCK WOULD IT NOT???"* to *"Does a branch's node work live at
spirit/<branch>/server/script.js, handing its verbs' answers to the scan"*): `verbs(node)`, an answer `{ request, reply, handler }`
for each verb of the old-shape branch's `spirit/peer/api.js`, over the hub and the router, mounted under its own word, peer;
none on a relay. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). What each answer does
is judged on a scratch node, at its one door, against the verb's own description, `spirit/peer/<verb>.json`. The peers are
keys made by the test; the relays are the scratch node's own list, read from its contact search.

## Requirements

- `spirit.requireScript` of its path hands back `{ verbs }` and nothing else.
- On a node, `verbs(node)` hands an answer for each verb `spirit/peer/api.js` declares and for no other, each with its request
  and its reply, objects, and its handler, a function; on a relay (`spirit.IS_RELAY`) none.
- **acquire** (`acquire.json`): a key into the contacts with its label, 201 `{ publicKey, publicLabel, keep: true }`, contact.get
  then showing it kept under that label. Refused 400 without a publicKey, for a publicLabel that breaks the name rule, and for
  this node's own key.
- **post** (`post.json`): to a peer no relay can reach, and via a relay that does not name it, refused 503.

## What its test must try to break

- A verb of the branch with no answer, or an answer for a verb the branch does not declare; an answer on a relay.
- An answer that does not do what its description says; this node's own key acquired.

## Known

- Where acquire found a key is written on its row, which no verb answers; a delivered post needs a seat on a relay: not here.
