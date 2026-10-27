# shell/js/contactDetails/contactDetails.js

One contact, as a page on the navigation (goal/G40.8): `window.spirit.elements.contactDetails.open({ key })` pushes it,
and it reads that row by `contact.get`. What it shows: the person's facts, My Label, and the buttons that decide about
them, Accept for a held row, Unblock for a blocked one, Block otherwise, and Forget for everybody.

This spec covers what goal/G41.9 asks of it: its two are-you-sure buttons are the shell element armingButton.

## Requirements (goal/G41.9)

- **It loads armingButton itself** (goal/G41.3), through `spirit.require('shell/js/armingButton.js')`.
- **Nothing hand-rolled is left**: no armed flags of its own (`cdBlockArmed`, `cdForgetArmed`), no `data-armed` in its
  markup, no `armUntilElsewhere` of its own, no `armed` class. The element does all of it.
- **Block is an arming button** (`armingButton.attach` or `create`), handed the page's api: label `Block`, armed
  `Block — press again` (today's wording). Its run asks `contact.block { publicKey }` for the row on screen. A blocked
  row offers Unblock instead, a plain button.
- **Forget is an arming button**, handed the page's api: label `Forget`, armed
  `Forget, and remove any seat on relays you own — press again`. Its run first gives up the seats: every relay this
  node owns (`spirit.relay.status`, a row `owned` with `roll.relayKey`) is posted `removePeer { key }`, and "no such
  peer" counts as done; only then `contact.forget { publicKey }`, and the page closes (`api.closeDialog`).
- **A press on the drawn button asks nothing by itself**: what the second press does is the arming button's run, never
  a click handler of the page's own.
- **One armed at a time** is the element's (it was this page's by hand).

## What its test must try to break

- An armed flag, `data-armed` or `armUntilElsewhere` left in the file.
- Block or Forget drawn as a plain button, or with other wording.
- A run that asks for another key, or a Forget that forgets before the seats are given up.
- Two presses on the drawn Block that block without the element.
