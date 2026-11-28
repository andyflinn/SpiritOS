# spirit/relay/client/script.js — its own test

What a client knows of a relay's branch (goal/G49.25, box v25: spirit.relay *"implemented properly as a system branch in the
tree"*): a relay's rows travel on its members' stream and in sealed answers, never on a node's job stream, so it keeps none
yet. It is the branch's other half, the family `spirit.relay` in the client's store. Owed since the rule *"every production
script has its own test"* (goal/G47.1, box v72). It runs beside the real `spirit/client/script.js`.

- In node, `spirit.requireScript('spirit/relay/script.js')` brings it, the one script that requires it, and it stands at
  `spirit.relay.client`.
- It puts out no reads of its own: no enumerable member.
- It keeps no rows: a job named `spirit.relay`, or one of the module `spirit.relay`, writes nothing into the family.
- `handle(branch)` is that branch of the family under the page's node: its `path`, and the rows it seats read back by `rows()`.
- `remote` is the row a job of the module `spirit.relay` last published; `watchRemote(fn)` hears each, and nothing once released.

## What its test must try to break

- A row of a node's job kept in the relay's family; a handle on another family or node; a watch that is not let go.
