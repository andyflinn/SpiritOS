# shell/js/natterDetails/natterDetails.js

One relay, as a page on the navigation (goal/G40.8): `window.spirit.elements.natterDetails.open({ url })` pushes it,
and it reads that relay's row by `spirit.relay.status`. Its panels fold; the owner's panels (Memory and disc, Invites)
sit in one more fold, "Managing my relay".

This spec covers what goal/G41.9 asks of it: its four are-you-sure buttons are the shell element armingButton.

## Requirements (goal/G41.9)

- **It loads armingButton itself** (goal/G41.3), through `spirit.require('shell/js/armingButton.js')`.
- **Nothing hand-rolled is left**: no `data-armed` in its code, no `armUntilElsewhere` of its own, no `armed` class.
  The element does all of it.
- **Every button below is an arming button** (`armingButton.attach` or `create`), handed the page's api, so a click
  elsewhere puts it back. Leave and Remove gain that reset: today they arm without it.
  - **Leave** (a relay this node holds a seat on and does not own): label `Leave this relay`, armed
    `Press again to leave`; its run asks `relay.leave { key: url }`.
  - **Remove** (a relay the removal rule lets go, `ownerBadge.removalRefusal`): label `Remove this relay`, armed
    `Press again to remove`; its run asks `relay.remove { key: url }`, and the page closes once the node says ok.
  - **Restart** (Memory and disc, an owned relay): label `Restart`, armed `Restart? Every stream drops`; its run posts
    the relay `config { restart: true }` and nothing else.
  - **Revoke** (each outstanding invite, an owned relay): label `Revoke`, armed `Revoke <name>?`; its run posts the
    relay `revoke { label: <name> }`.
- **A press on the drawn button asks nothing by itself**: what the second press does is the arming button's run, never
  the page's own click handler.

## What its test must try to break

- `data-armed`, `armUntilElsewhere` or an `armed` class left in the file.
- A button drawn plain, with other wording, or without the page's api.
- A run that asks for another relay, another invite, or sends figures with a restart.
- Two presses on the drawn Remove that remove the relay without the element.
