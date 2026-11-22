# spirit/contact/script.js

The owner's acts on the contacts, rows of the one table (`seen` in node.db): where the star comes from, and the verb that
sets 😏. This test holds one part of it (goal/G47.4).

## Requirements

The box, v33: *"the star is shown as before on nodes and relays and is set only by true ownership (the signed card names
this node as owner); no button or verb changes it"*, *"😏 is the row field faceable, set by the new verb contact.faceable
{key, faceable}, for a relay this node holds a seat on only; it does what own did"*, *"contact.own goes"*. Andy: *"it needs
TWO fucking fields, - one signifying \"mine\" and not changeable by the ui or a verb. - and \"faceable\", settable by a user,
with a verb by the same fucking name."*

- **The star is the card's owner.** `setCard` keeps a valid signed card and sets `mine`: on when the card names this node's
  key as its owner, off when a newer card names another or nobody.
- **No verb sets the star.** On a scratch node, over a raw POST: a row whose card names the scratch node is starred with no
  verb asked, one whose card names another is not; `contact.own` is no verb.
- **`contact.faceable {key, faceable}`**, declared in `spirit/contact/api.js` as `faceable: { key: 'key', faceable: 'bool' }`,
  refuses with a code a node (it is for a relay with a seat alone), a key with no row, a `faceable` that is not a bool and a
  key of the wrong type, and changes no star. Its relay half is in `./hub.js`.

## What its test must try to break

- A card naming another owner left starred, or one naming this node left without the star.
- A star set or taken by any verb.
- 😏 on a node.
