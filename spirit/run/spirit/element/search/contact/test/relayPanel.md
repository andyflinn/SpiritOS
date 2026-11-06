# spirit/element/search/contact/relayPanel.js

One relay, a shell element (goal/G41.32): `spirit.element.search.contact.relayPanel.create(container, { key })`, and `open({ key })` pushes it
as a page on the navigation (goal/G40.8). It reads that relay's row by `spirit.relay.status` as it is drawn, and listens after
that: `spirit/element/test/relayRowStream.md`. Its panels fold; the owner's panels (Memory and disc, Invites)
sit in one more fold, "Managing my relay".

This spec covers what goal/G41.9 asks of it: its four are-you-sure buttons are the shell element armingButton.

## Requirements (goal/G41.9)

- **It loads armingButton itself** (goal/G41.3), through `spirit.require('spirit/element/armingButton.js')`.
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

- **The star on a relay, with who you have to trust** (goal/G41.30; Andy: *"the message is different for members and owners,
  showing members who they have to trust, and, if the relay claims to be mine, the message should be slightly different"*;
  *"NO signature. just the armingButton, with a precise documentation of the risk."*): `.nd-own`, an armingButton. A relay not
  claiming this node (`owned` false): *"says it is owned by"* its `ownerLabel`, and that this person and anyone holding the
  relay can run programs and change files on this machine. A relay claiming it: *"If you DID install this relay on a VPS and
  you DID set its DNS records"*, and that otherwise it is lying. Its second press sends `contact.own {key: the relay's key,
  own: true}`, on a starred row (`mine`) `own: false`; a press alone sends nothing. On a face no button is drawn.

## What its test must try to break

- `data-armed`, `armUntilElsewhere` or an `armed` class left in the file.
- A button drawn plain, with other wording, or without the page's api.
- A run that asks for another relay, another invite, or sends figures with a restart.
- Two presses on the drawn Remove that remove the relay without the element.
