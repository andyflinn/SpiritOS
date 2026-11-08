# spirit/test/apiDoor-familyGate.js

A general rule over the node's own families (goal/G41.30; Andy, of *"only the spirit object checks those rules, on the
caller's side. A raw call to /api/spirit, the attacker's way, reaches the handler unchecked"*: *"this needs fixing in
this item."*; `spirit.js`: *"The node stays the gate and checks everything again."*).

## Requirements

- **Every broken call is refused at the door.** From each `spirit/<family>/api.js`, its verbs and each argument's rule, a
  raw call over http, no spirit object, breaks a verb's arguments three ways: an argument of the wrong type, a required
  one left out, one the verb does not name. Each must answer a 4xx with a `code`, never a 2xx, a 5xx, a handler failed,
  or no answer within 8 s.
- It runs on a scratch node. It must have judged something: over 5 families and over 100 calls.

## What its test must try to break

- A handler reached by a call its own family's declaration refuses.
