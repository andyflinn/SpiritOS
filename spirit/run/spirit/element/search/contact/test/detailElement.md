# spirit/element/search/contact/detailElement.js

One contact, as a panel (goal/G43.18; it was a page on the navigation, goal/G40.8): `window.spirit.element.search.contact.detailElement.create(box, { key, layer })` draws it, with no `open` of its own,
and it reads that row by `contact.get`. What it shows: the person's facts, My Label, and the buttons that decide about
them, Accept for a row not kept, Unblock for a blocked one, Block otherwise, and Forget for everybody.

This spec covers what goal/G41.9 asks of it: its two are-you-sure buttons are the shell element armingButton.

**What it needs, it requires itself** (goal/G43.24; Andy: *"every element that accesses ANY api must require them themselves,
(fast if an other element already required it), that way anybody can mount any element without knowing what it actually
needs...."*): every verb it asks is `family.verb` on `spirit.ready`, a refusal said with the node's status and words; it
escapes with `spirit.escapeHtml`. It is handed no api: `layer` is only the layer it is drawn in, `close()` and
`setTitle(text)`, the mounter's (`search/contact/rowElement.js`). Mounted with its key alone it reads the row and draws it.

## Requirements (goal/G41.9)

- **It knows the contact's type** (goal/G43.32; Andy: *"the contact list already knows the difference between contact types.
  so should the detail panel."*): told `relay: true`, or holding a relay's row in the contact family's cache, it draws that
  relay's panel (`./relayPanel.js`, loaded when first opened) into its container, and destroy lets the panel go; a person's
  details are its own.

- **It loads armingButton itself** (goal/G41.3), through `spirit.require('spirit/element/armingButton.js')`.
- **Nothing hand-rolled is left**: no armed flags of its own (`cdBlockArmed`, `cdForgetArmed`), no `data-armed` in its
  markup, no `armUntilElsewhere` of its own, no `armed` class. The element does all of it.
- **Block is an arming button** (`armingButton.attach` or `create`), handed no api: label `Block`, armed
  `Block — press again` (today's wording). Its run asks `contact.block { publicKey }` for the row on screen. A blocked
  row offers Unblock instead, a plain button.
- **Forget is an arming button**, handed no api: label `Forget`, its armed words saying nothing of seats or
  relays. It only deletes the row (goal/G43.17, Andy: *""forget" a contact means only: delete that row from my contacts.
  it does NOT mean: "eject them from relays i own", not at all. not the same scope of decision."*): with a relay this
  node owns in the world, its run posts nothing to any relay, asks `contact.forget { publicKey }`, and the page closes
  (`layer.close`).
- **A press on the drawn button asks nothing by itself**: what the second press does is the arming button's run, never
  a click handler of the page's own.
- **One armed at a time** is the element's (it was this page's by hand).

- **The star, at home, two presses** (goal/G41.30; Andy: *"so this button will put the star on relays and puppets. AND take it
  away."*; *"NO signature. just the armingButton, with a precise documentation of the risk."*): `#cd-own`, an armingButton,
  beside the words of what it gives: its streams taken without asking, and it is never dropped. Its second press sends
  `contact.own {key, own: true}`, on a starred row `own: false`; a press alone sends nothing. On a face
  (`window.spirit.transport`) no button is drawn.

## What its test must try to break

- An armed flag, `data-armed`, `armUntilElsewhere` or an api left in the file.
- Block or Forget drawn as a plain button, or with other wording.
- A run that asks for another key, or a Forget that removes a seat on any relay.
- Two presses on the drawn Block that block without the element.

## The peer counters are gone (goal/G43.14)

Andy: *"KILL those fields in shadow-roll, KILL the functionality, KILL it!"*

- A contact's detail shows no unanswered inbound, no inbound rate and no outbound rate, even for a row that still carries them.
