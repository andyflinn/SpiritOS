# spirit/app/starter/starter.js

The smallest app of the new shape (goal/G43.27; Andy: "cw, you bring deskClient and deskVerify into spirit/app/ under
their old names, do the backup as well (and fix it) and starter as well"). Its test is `./starter.js`: the browser file
run in node on a bare window, the node's family a stand-in that answers `node.card`.

## Requirements

1. **One element**: `spirit.elements.starter.create(container, opts)`, answering `{ destroy() }`.
2. **It asks its node once**: `node.card` through `spirit.ready` and `spirit.outcome`, nothing else, no `spirit.require`.
3. **It shows what the card says**: the node's name and its description, each in its own row, in the container.
4. **A refusal is said, not swallowed**: a card that does not come back draws a `refused` row with the error.
5. **Destroy empties its container**, and an answer that comes after it draws nothing.
6. **Its `starter.json` is the app shape**: `identity` with label `Starter`, not intrinsic; `mount` names `starter.js`;
   a shell mount and a tile; no node mount, so the node starts nothing for it.

## What its test must try to break

- An element that asks for more than the card, or asks twice.
- A card drawn without its name or its description.
- A refusal that draws nothing.
- A destroyed starter that draws a late answer.
- A manifest that makes it intrinsic or gives it a server.
