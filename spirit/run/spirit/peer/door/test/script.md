# spirit/peer/door/script.js

The door a member's `api` packet comes in by. Its gate is `answer(servers, ask, caller)`. This file specifies the gate
only where a requirement here names it; the rest of the door is specified by its earlier items in its own header.

## Requirements

### No FS set (goal/G43.20)

Andy: *"those owner only FS verbs are no longer needed, because not the api ID spirit.fs or spirit.api.desk ARE the path
to all those files, that's why they are now completely redundant."*

- `apiDoor.js` names no `FS.` verb.
- A member granted a family reaches its verbs, and is served its tree.

### No verb is hard-coded the owner's (goal/G49.25)

Andy: *"the only thing i'd hard-code protect from is ownership change, and the node has no verbs for that"*, and of the
owner-only guards: *"they go now"*.

- **The star is granted as any verb**: a member granted `spirit.contact` or `spirit.contact.faceable` asking
  `spirit.contact.faceable` reaches the server; a member granted only `spirit.contact.get` asking it is refused `not-granted`
  with no server asked; the owner reaches it.
- A member granted `spirit.contact` is served a tree holding `faceable`; one granted only `spirit.contact.get` a tree holding
  `get` alone.

## What its test must try to break

- A granted faceable ask refused, or answered without the server being asked.
- An ungranted faceable ask let through, refused by any code but `not-granted`, or a server asked before the refusal.
- `faceable` missing from a granted member's tree, or present in an ungranted one's.
- The owner refused.

## A registered server goes by its name

goal/G43.12, the box: *"No gate changes for a caller: once a server is registered, the door and the grants go by its name."* (once in `./appServer.js`'s mount part, goal/G47.1). For a server `probe`: a member with no grant asking `probe.ping` is refused and no server is asked; a member granted `probe.ping` reaches it.
