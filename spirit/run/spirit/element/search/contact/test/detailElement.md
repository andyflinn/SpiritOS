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
  relay's details, what `relayPanel.js` drew until then and this file draws now (judged in its relay section below); a
  person's are the rest. It loads no `relayPanel.js`.

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

## A relay (once detailElement-relay.js)

One relay (goal/G41.32), drawn by the one contact detail since goal/G43.32 (Andy: *"the contact list already knows the difference
between contact types. so should the detail panel."*); `spirit/element/search/contact/relayPanel.js` until then. Its test is
the relay part of `./detailElement.js` (once `./detailElement-relay.js`). `spirit.element.spirit.element.search.contact.detailElement.create(container, { key, layer, relay: true })`, a panel with no `open`
of its own (goal/G43.18; it was a page on the navigation, goal/G40.8). It reads that relay's row by `spirit.relay.status` as it is drawn, and listens after
that: the relayRowStream section below. Its panels fold; the owner's panels (Memory and disc, Invites)
sit in one more fold, "Managing my relay".

This spec covers what goal/G41.9 asks of it: its four are-you-sure buttons are the shell element armingButton.

**What it needs, it requires itself** (goal/G43.24; Andy: *"every element that accesses ANY api must require them themselves,
(fast if an other element already required it), that way anybody can mount any element without knowing what it actually
needs...."*): the node's verbs are `family.verb` on `spirit.ready`; a post to the relay is `spirit.peerPost`, which puts
its body in its packet envelope and posts it through the node's `peer.post` (goal/G43.24), the relay's answer read out
of its envelope; the panel encodes no packet of its own. It is handed no api: `layer` is only the layer it is drawn in, `close()` and `setTitle(text)`, the contact
row's; its title goes there.

### Requirements (goal/G41.9)

- **It loads armingButton itself** (goal/G41.3), through `spirit.require('spirit/element/armingButton.js')`.
- **Nothing hand-rolled is left**: no `data-armed` in its code, no `armUntilElsewhere` of its own, no `armed` class.
  The element does all of it.
- **Every button below is an arming button** (`armingButton.attach` or `create`), handed no api: the button hears a
  click elsewhere itself.
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

### What its test must try to break

- `data-armed`, `armUntilElsewhere` or an `armed` class left in the file.
- A button drawn plain, with other wording, or handed an api; an api in its code; a post to the relay outside its envelope.
- A run that asks for another relay, another invite, or sends figures with a restart.
- Two presses on the drawn Remove that remove the relay without the element.

## A relay's row and its detail: who paints, listens (once detailElement-relayRowStream.js)

Its test is the relayRowStream part of `./detailElement.js`. A relay's row and its detail, the one contact detail since goal/G43.32 (relayPanel.js and relayPanel-rowStream.js until then).

goal/G41.32. Andy, Q13: *"every row's data, wherever it's visible must update instantly: who paints, listens."*, and *"BEING
INVISIBLE doesn't change a elements fucking duty to listen to fucking changes"*. A real scratch node and relay, the node's own
stream, a real Chrome.

### Requirements

- **A relay's row carries** `claimed`, `status`, `services`, `roll` and `owned`, under the names `relay.get` answers them,
  published as each changes: a seat taken, the stream dropped and back, a report arriving, a card changing.
- **A report goes on the relay event, whole, and never on a row**: rows reach every face, starred or not, and a report lists invites.
- **A relay's detail** is the one contact detail, `spirit/element/search/contact/detailElement.js`, `create(host, { key, relay: true })` (goal/G43.32), and `spirit/element/natterDetails` is gone.
- **The star is a folding panel like the others** (Andy: *"must use the same heading and style al all the other folding panels in relayPanel"*): the same heading, tile and fold mark, shut as it arrives, holding its button when opened.
- **"A face name" shows the faceForm, unless the relay is starred** (Andy: *"the folding panel "A face name" should actually show the faceForm, unless the relay is "starred""*): opened, it holds the form's field and button; the star on, the fold goes with no reload; off, it comes back. Judged on boot.js's shell at /face.html, the one he uses.
  **Turned round since**, as the face form below: relayPanel's fold asks `faceForm.offers`, so since goal/G43.18 (box v29) it
  shows only on a starred relay. This requirement and its checks still assert the old rule, so they fail against the code.
- **The face form offers relays this node is a member of or owns, with no star** (Andy, in the chat; his line on who owns is read as today's filter), and `faceForm.offers(relays)` says whether it has any.
  **Turned round since**: goal/G43.18's box (v29), Andy: *"on the home node, NO face is offered (faceForm hides itself) for a
  relay without star."* `spirit/element/faceForm.js` follows that: it offers a starred relay only. This requirement and its
  checks (the face form's check, and Info following the star) still assert G41.32's rule, so they fail against the code. In Info, a star pressed at home takes that relay from the dropdown with no reload and no read; every relay starred, there is no form and no empty tile; a star off brings it back.
- **A relay this node is not a member of cannot be starred** (Andy: *"a relay I'm not a member of can not be starred (relays i own automatically give me membership)"*): `contact.own` refuses it at the node with a code, its panel offers no star; a member can; leaving takes the star away, and it cannot be put back; an owned relay can.
- **The contact list marks a relay** (Andy: *"print its label in bold-italic"*): a relay's label is bold and italic, a person's is not.
- **It listens, shown or hidden**: a change is painted with no further `relay.status` or `relay.get`. **It follows only its row.**
- **Gone from the page, it stops**: after `destroy` a change neither throws nor paints.

### What its test must try to break

- A panel that re-reads on a nudge. A panel that stops while hidden. A report on a row, reaching a face with no star.
