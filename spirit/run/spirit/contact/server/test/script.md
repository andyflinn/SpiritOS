# spirit/contact/server/script.js — its own test

The spirit.contact branch's node work (goal/G49.25, Q5; Andy: *"WHY THE FUCK WOULD IT NOT???"* to *"Does a branch's node work
live at spirit/<branch>/server/script.js, handing its verbs' answers to the scan"*): `verbs(node)`, an answer `{ reply, handler }`
for each verb of `spirit/contact/script.js`, over this node's one table, its hub and its router; none on a relay. Owed since the
rule *"every production script has its own test"* (goal/G47.1, box v72). The verbs are read from the branch's script; what each
answer does is judged on a scratch node, at its one door, against the verb's own description, `spirit/contact/<verb>.json`.
The people are keys made by the test; the relay is a scratch relay (`scratchRelay`), put on the node's list by its own add.

## Requirements

- `spirit.requireScript` of its path hands back `{ verbs }` and nothing else.
- On a node, `verbs(node)` hands an answer for each verb `spirit/contact/script.js` declares and for no other, each with its
  reply, an object, and its handler, a function; on a relay (`spirit.IS_RELAY`) none.
- **add**: the scratch relay by its url once its card answers, `{ ok, url, relayKey }`, the key the relay's own; a url whose
  relay gives no card is 502.
- **block**: a key with no row gets one, named by publicLabel, `{ publicKey, keep, blocked: true }`; this node's own key is 400.
- **get**: `{ ok, key, person }`, the person with every field its description names; a relay's row also its relay row and
  report; a key with no row is 404.
- **search**: `{ ok, items, more }`, each label the row as JSON with its name and its flags, booleans; the relay and blocked
  yes-filters answer those rows alone.
- **unblock**: the block off and nothing more, a person never added staying out of the contacts; **accept**: kept and
  unblocked; **label**: `{ publicKey, myLabel, caption }`, the caption the name, an empty one clearing it back to the key's own
  label. Each refuses this node's own key, 400.
- **faceable**: on, 403 not-a-relay for a person's row and 403 no-seat for a relay with no seat; off, `{ key, faceable: false }`.
- **claim**: on the relay's row, the relay's own answer under its status, with `mine`; a key naming no relay row is 503.
- **face**: on the relay's row, the relay's refusal for a node it holds no email of; a key naming no relay on the list is 404.
- **join**: by email at a relay that sends no mail, the relay's own refusal under its status; a key naming no relay row is 400.
- **leave**: a relay this node holds no seat on is 404.
- **forget**: a person out, `{ publicKey, forgotten: true, stillBlocked: false }`, get then 404; a blocked key keeps its row,
  blocked, `stillBlocked: true`; a relay's row taken off the list; this node's own key is 400.

## What its test must try to break

- A verb of the branch with no answer, or an answer for a verb the branch does not declare; an answer on a relay.
- An answer that does not do what its description says; this node's own key blocked, forgotten or relabelled.

## Known

- A seat (claim with an invite, join with a mailed code), a face, and leave's yes need a relay that mails and invites: not here.
