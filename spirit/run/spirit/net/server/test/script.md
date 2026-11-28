# spirit/net/server/script.js — its own test

The net branch's node work (goal/G49.25, Q5; Andy: *"WHY THE FUCK WOULD IT NOT???"* to *"Does a branch's node work live at
spirit/<branch>/server/script.js, handing its verbs' answers to the scan"*): `verbs(node)`, `{ fetch: { request, reply, handler } }`,
the node's outbound proxy, mounted under the old-shape branch's own word, net; none on a relay. Owed since the rule *"every
production script has its own test"* (goal/G47.1, box v72). The verbs are read from the branch's `spirit/net/api.js`; what the
answer does is judged on a scratch node, at its one door, against the verb's own description, `spirit/net/fetch.json`.

## Requirements

- `spirit.requireScript` of its path hands back `{ verbs }` and nothing else.
- On a node, `verbs(node)` hands an answer for each verb `spirit/net/api.js` declares and for no other, each with its request
  and its reply, objects, and its handler, a function; on a relay (`spirit.IS_RELAY`) none.
- **fetch** never reaches this machine (Andy, 2026-10-18: *"fetch will not be able to reach ports on this machine, and agents
  may use it."*): a url on loopback, localhost, 0.0.0.0, `::` or one of this machine's own interface addresses is refused 403,
  code this-machine, and nothing is sent: a server of the test's own on this machine counts no request.
- **fetch** with no url, or a url that is neither http nor https, is refused 400.

## What its test must try to break

- A verb of the branch with no answer, or an answer for a verb the branch does not declare; an answer on a relay.
- A request that reaches this machine.

## Known

- The outside answer passed on as it comes, its status and content type kept, needs a target off this machine: not here.
