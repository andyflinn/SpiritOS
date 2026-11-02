# spirit/apiDoor.js

The door a member's `api` packet comes in by. Its gate is `answer(servers, ask, caller)`. This file specifies the gate
only where a requirement here names it; the rest of the door is specified by its earlier items in its own header.

## Requirements

### A family's FS group is the owner's (goal/G41.28)

Andy: *"i still want the api.<family>.FS.* group "ungrantable" and OWNER ONLY"*.

- A member's ask of any `<family>.FS.*` verb is refused `owner-only`, with the family granted whole or the verb
  itself granted, and no server is asked.
- The same member's other verbs of that family reach its server.
- A member's `api` tree leaves out every family's `FS.*` verbs.
- The owner's `FS.*` asks reach the server.

- **The star is the owner's alone** (goal/G41.30; Andy: *"so this button will put the star on relays and puppets. AND
  take it away."*): a member granted `contact` or `contact.own` asking `contact.own` is refused `owner-only` with no server
  asked; the owner reaches it; a member's tree holds no `contact.own`.

## What its test must try to break

- A grant, of the family or of the exact verb, that lets an FS ask through; a refusal by any code but `owner-only`.
- A server asked before the refusal.
- An FS verb left in a member's tree.
- The owner refused.
