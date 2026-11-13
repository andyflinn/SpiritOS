# spirit/DEBUG/garbageArguments.js — its own test

The worst arguments a server's api could be sent (goal/G41.19, `../../test/DEBUG.md`; Andy: *"from the introspections, it
will generate the most garbage arguments, that could be thrown at the api, and check the responses."*). Made from the
server's own api tree. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). In
process: `make` is handed a planted server whose `api()` answers a planted tree.

- `make`: JSON typed `application/json; charset=utf-8`; null for an address that is not `.json`, for a server with no
  `api`, and for a module whose name is no family with verbs in the tree (the family is the module's name).
- The door as it is: on a node `{ call: '<family>.<verb>', args }`, plus one call naming two verbs per verb; on a relay
  its ask, `{ body: { <verb>: args } }`, and no two-verb call.
- A verb that takes nothing: a string, a number, an array, an argument it does not declare.
- The scheme of goal/G41.30: every argument given every type JSON.parse makes and `missing`, alone; *"Pairs, not every
  combination"*: any two arguments meet in every pairing of their kinds but both-as-declared, in fewer entries than every
  combination; the extraneous entry; nesting 64 deep; every string argument in the sizes 0, 1, 100 and 3/4 of the
  payload, and with each bad character (NUL, lone surrogate, control characters, quote and backslash, a path piece).
- The bad strings and the long one go alone, every other argument as declared and nothing added, so they reach the
  handler (Andy: *"fill this gap, in this item"*); every other entry breaks the shape; the declared call itself is never
  sent; a short plain string carries an undeclared argument.

## What its test must try to break

A pairing of kinds never met; the two-verb call dropped or sent to a relay; the 3/4-payload size gone; a bad string sent
with an extra argument (the gate refuses it and the handler is never reached); an entry that keeps the shape and could
be acted on.
