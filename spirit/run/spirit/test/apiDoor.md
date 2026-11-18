# spirit/apiDoor.js

The door a member's `api` packet comes in by. Its gate is `answer(servers, ask, caller)`. This file specifies the gate
only where a requirement here names it; the rest of the door is specified by its earlier items in its own header.

## Requirements

### No FS set (goal/G43.20)

Andy: *"those owner only FS verbs are no longer needed, because not the api ID spirit.fs or spirit.api.desk ARE the path
to all those files, that's why they are now completely redundant."*

- `apiDoor.js` names no `FS.` verb: DEBUG is a server's one owner verb.
- A member granted a family reaches its verbs, and is served its tree.

- **The star is the owner's alone** (goal/G41.30; Andy: *"so this button will put the star on relays and puppets. AND
  take it away."*): a member granted `contact` or `contact.faceable` asking `contact.faceable` is refused `owner-only` with no server
  asked; the owner reaches it; a member's tree holds no `contact.faceable`.

## What its test must try to break

- A grant, of the family or of the exact verb, that lets an FS ask through; a refusal by any code but `owner-only`.
- A server asked before the refusal.
- An FS verb left in a member's tree.
- The owner refused.

## A registered server goes by its name

goal/G43.12, the box: *"No gate changes for a caller: once a server is registered, the door and the grants go by its name."* (once in `./appServer.js`'s mount part, goal/G47.1). For a server `probe`: a member with no grant asking `probe.ping` is refused and no server is asked; a member granted `probe.ping` reaches it.
