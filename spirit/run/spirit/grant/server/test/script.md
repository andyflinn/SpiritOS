# spirit/grant/server/script.js — its own test

The spirit.grant branch's node work (goal/G49.25, Q5; Andy: *"WHY THE FUCK WOULD IT NOT???"* to *"Does a branch's node work
live at spirit/<branch>/server/script.js, handing its verbs' answers to the scan"*): `verbs(node)`, an answer `{ reply, handler }`
for each verb of `spirit/grant/script.js`, over the owner's allow-table (`spirit/grant/auth/script.js`); none on a relay. Owed
since the rule *"every production script has its own test"* (goal/G47.1, box v72). The verbs are read from the branch's
script; what each answer does is judged on a scratch node, at its one door, against the verb's own description,
`spirit/grant/<verb>.json`. The member is a key made by the test; the path granted is this branch's first verb, the owner-only
paths are read from `spirit/fs/script.js` and `spirit/contact/script.js`.

## Requirements

- `spirit.requireScript` of its path hands back `{ verbs }` and nothing else.
- On a node, `verbs(node)` hands an answer for each verb `spirit/grant/script.js` declares and for no other, each with its
  reply, an object, and its handler, a function; on a relay (`spirit.IS_RELAY`) none.
- **get** (`get.json`): `{ allowed }`, false before the grant and after its delete, true while it stands.
- **add** (`add.json`): `{ key, label, path }`, the label empty for a key nobody named. Refused: a path the key holds
  (409 already-granted), spirit.fs and a verb of it and contact.faceable (403 owner-only), a path no server serves and no grant
  names (404 unknown-path).
- **search** (`search.json`): with no words every grant, `{ ok, items, more }`; by words the grant they name, its key the key, a
  newline and the path, its label `{ name, key, path }` as JSON.
- **delete** (`delete.json`): `{ revoked: true }`, get then false; a path a known key (the node's own, from its card) does not
  hold is refused 403 not-granted.

## What its test must try to break

- A verb of the branch with no answer, or an answer for a verb the branch does not declare; an answer on a relay.
- An answer that does not do what its description says; an owner-only path granted.
