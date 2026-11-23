# spirit/element/search/contact/detail.js

One contact, as a panel (goal/G43.18; it was a page on the navigation, goal/G40.8): `window.spirit.required.search.contact.detail.create(box, { key, layer })` draws it, with no `open` of its own,
and it reads that row by `contact.get`. What it shows: the person's facts, My Label, and the buttons that decide about
them, Accept for a row not kept, Unblock for a blocked one, Block otherwise, and Forget for everybody.

This spec covers what goal/G41.9 asks of it: its two are-you-sure buttons are the shell element armingButton.

**What it needs, it requires itself** (goal/G43.24; Andy: *"every element that accesses ANY api must require them themselves,
(fast if an other element already required it), that way anybody can mount any element without knowing what it actually
needs...."*): every verb it asks is `family.verb` on `spirit.readyPromise`, a refusal said with the node's status and words; it
escapes with `spirit.escapeHtml`. It is handed no api: `layer` is only the layer it is drawn in, `close()` and
`setTitle(text)`, the mounter's (`search/contact/row.js`). Mounted with its key alone it reads the row and draws it.

## Requirements (goal/G41.9)

- **It knows the contact's type** (goal/G43.32; Andy: *"the contact list already knows the difference between contact types.
  so should the detail panel."*): told `relay: true`, or holding a relay's row in the contact family's cache, it draws that
  relay's details, what `relayPanel.js` drew until then and this file draws now (judged in its relay section below); a
  person's are the rest. It loads no `relayPanel.js`.

- **It loads armingButton itself** (goal/G41.3), through `spirit.requireScript('spirit/element/armingButton.js')`.
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

- **😏 on a relay's contact detail, at home, two presses; none on a node's** (goal/G47.4, box v33: *"in the detail panel (for
  relays only) 😏 will be an option to enable face related forms in the UI, and enable full face capability for this node in
  the relay"*, *"the star is shown as before ... not changeable"*; Andy, of the star before it: *"NO signature. just the
  armingButton, with a precise documentation of the risk."*): a node's detail, starred or not, draws neither `#cd-faceable`
  nor a star button. A seated relay's draws `#cd-faceable`, an armingButton, beside the words of what it gives: a face there
  can run programs and change files on this machine. Its second press sends `contact.faceable {key, faceable: true}`, on a
  faceable row `faceable: false`; a press alone sends nothing. A relay with no seat, and any row on a face
  (`window.spirit.transport`), draws no button.

## What its test must try to break

- An armed flag, `data-armed`, `armUntilElsewhere` or an api left in the file.
- Block or Forget drawn as a plain button, or with other wording.
- A run that asks for another key, or a Forget that removes a seat on any relay.
- Two presses on the drawn Block that block without the element.

## The peer counters are gone (goal/G43.14)

Andy: *"KILL those fields in shadow-roll, KILL the functionality, KILL it!"*

- A contact's detail shows no unanswered inbound, no inbound rate and no outbound rate, even for a row that still carries them.

## A relay (once detail-relay.js)

One relay (goal/G41.32), drawn by the one contact detail since goal/G43.32 (Andy: *"the contact list already knows the difference
between contact types. so should the detail panel."*); `spirit/element/search/contact/relayPanel.js` until then. Its test is
the relay part of `./detail.js` (once `./detail-relay.js`). `spirit.required.spirit.element.search.contact.detail.create(container, { key, layer, relay: true })`, a panel with no `open`
of its own (goal/G43.18; it was a page on the navigation, goal/G40.8). It reads that relay's row by `spirit.relay.status` as it is drawn, and listens after
that: the relayRowStream section below. Its panels fold; the owner's panels (Memory and disc, Invites)
sit in one more fold, "Managing my relay".

This spec covers what goal/G41.9 asks of it: its four are-you-sure buttons are the shell element armingButton.

**What it needs, it requires itself** (goal/G43.24; Andy: *"every element that accesses ANY api must require them themselves,
(fast if an other element already required it), that way anybody can mount any element without knowing what it actually
needs...."*): the node's verbs are `family.verb` on `spirit.readyPromise`; a post to the relay is `spirit.peerPost`, which puts
its body in its packet envelope and posts it through the node's `peer.post` (goal/G43.24), the relay's answer read out
of its envelope; the panel encodes no packet of its own. It is handed no api: `layer` is only the layer it is drawn in, `close()` and `setTitle(text)`, the contact
row's; its title goes there.

### Requirements (goal/G41.9)

- **It loads armingButton itself** (goal/G41.3), through `spirit.requireScript('spirit/element/armingButton.js')`.
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

- **😏 on a relay, with who you have to trust** (goal/G41.30, of the star; goal/G47.4, box v33: 😏 "does what own did"; Andy:
  *"the message is different for members and owners, showing members who they have to trust, and, if the relay claims to be
  mine, the message should be slightly different"*; *"NO signature. just the armingButton, with a precise documentation of the
  risk."*): `.nd-faceable`, an armingButton, in the fold "Give this relay full face capability". A relay not
  claiming this node (`owned` false): *"says it is owned by"* its `ownerLabel`, and that this person and anyone holding the
  relay can run programs and change files on this machine. A relay claiming it: *"If you DID install this relay on a VPS and
  you DID set its DNS records"*, and that otherwise it is lying. Its second press sends `contact.faceable {key: the relay's
  key, faceable: true}`, on a faceable row `faceable: false`; a press alone sends nothing. On a face no button is drawn.

### What its test must try to break

- `data-armed`, `armUntilElsewhere` or an `armed` class left in the file.
- A button drawn plain, with other wording, or handed an api; an api in its code; a post to the relay outside its envelope.
- A run that asks for another relay, another invite, or sends figures with a restart.
- Two presses on the drawn Remove that remove the relay without the element.

## A relay's row and its detail: who paints, listens (once detail-relayRowStream.js)

Its test is the relayRowStream part of `./detail.js`. A relay's row and its detail, the one contact detail since goal/G43.32 (relayPanel.js and relayPanel-rowStream.js until then).

goal/G41.32. Andy, Q13: *"every row's data, wherever it's visible must update instantly: who paints, listens."*, and *"BEING
INVISIBLE doesn't change a elements fucking duty to listen to fucking changes"*. A real scratch node and relay, the node's own
stream, a real Chrome.

### Requirements

- **A relay's row carries** `claimed`, `status`, `services`, `roll` and `owned`, under the names `relay.get` answers them,
  published as each changes: a seat taken, the stream dropped and back, a report arriving, a card changing.
- **A report goes on the relay event, whole, and never on a row**: rows reach every face, starred or not, and a report lists invites.
- **A relay's detail** is the one contact detail, `spirit/element/search/contact/detail.js`, `create(host, { key, relay: true })` (goal/G43.32).
- **😏 is a folding panel like the others** (Andy: *"must use the same heading and style al all the other folding panels in relayPanel"*): the same heading, tile and fold mark, shut as it arrives, holding its button when opened.
- **"A face name" shows only on a faceable relay** (goal/G43.18's box, v29, Andy: *"on the home node, NO face is offered
  (faceForm hides itself) for a relay without star."*, the star's job 😏's since goal/G47.4, box v33): with no 😏, no fold;
  😏 on, the fold comes with no reload, and opened it holds the form's field and button; 😏 off, it goes again. Judged on
  boot.js's shell at /face.html.
- **The face form offers the faceable relays only**, and `faceForm.offers(relays)` says whether it has any: true for a
  faceable relay, alone or beside one without 😏; false for a member's or an owner's relay without 😏, one it holds no seat on,
  and none. In Info it follows 😏 with no reload and no read: neither faceable, no form and no empty tile; one, it offers that
  one alone; both, both; 😏 off one, that one goes.
- **The lab holds two relays** (`lab/labNodes.js`): a relay whose checks are over is stopped and freed before the next is asked for.
- **A relay this node is not a member of cannot be made faceable** (Andy, of the star: *"a relay I'm not a member of can not be starred (relays i own automatically give me membership)"*; box v33: 😏 *"for a relay this node holds a seat on only"*): `contact.faceable` refuses it at the node with a code, and refuses a node; its panel offers no 😏; a member can; leaving takes 😏 away, and it cannot be put back; an owned relay can.
- **The contact list marks a relay** (Andy: *"print its label in bold-italic"*): under 📡 Relays (the app opens on People, which shows no relay: goal/G47.4, box v29) a relay's label is bold and italic; under 👨‍👩‍👧‍👦 People a person's is not.
- **It listens, shown or hidden**: a change is painted with no further `relay.status` or `relay.get`. **It follows only its row.**
- **Gone from the page, it stops**: after `destroy` a change neither throws nor paints.

### What its test must try to break

- A panel that re-reads on a nudge. A panel that stops while hidden. A report on a row, reaching a face with no star.
- It fills its host and scrolls its own body, so the panel's title bar above it stays (Q21: the panel itself never scrolls); judged by
  `spirit/element/test/search-child-browser.js`.

## Box v170: the relay's capacity, one figure (goal/G47.1)

The box: *"The relay detail shows of its capacity one figure: how many members it can serve with the RAM it is given. The
rows Streams, Members a megabyte, At rest and Free go."* The facts the panel draws of a relay's report (`ndGovernorFacts`),
taken from the file and run alone on a report holding every part of its capacity: no row Streams, Members a megabyte,
At rest or Free, and of the capacity's figures exactly one row, the members it serves.
