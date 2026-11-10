# spirit/element/search/contact/test/detailElement-relayRowStream.js

A relay's row and its detail, the one contact detail since goal/G43.32 (relayPanel.js and relayPanel-rowStream.js until then).

goal/G41.32. Andy, Q13: *"every row's data, wherever it's visible must update instantly: who paints, listens."*, and *"BEING
INVISIBLE doesn't change a elements fucking duty to listen to fucking changes"*. A real scratch node and relay, the node's own
stream, a real Chrome.

## Requirements

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

## What its test must try to break

- A panel that re-reads on a nudge. A panel that stops while hidden. A report on a row, reaching a face with no star.
