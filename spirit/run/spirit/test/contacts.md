# spirit/contacts.js

The owner's acts on the contacts, rows of the one table (`seen` in node.db), and the verb that sets a contact's star. This test holds one part of it (goal/G41.30).

## Requirements

Andy: *"NO signature. just the armingButton, with a precise documentation of the risk."*; *"so this button will put the
star on relays and puppets. AND take it away."*

- **A card sets no star.** `setCard` keeps a valid signed card and leaves `mine` as it found it, whatever owner the card
  names: anyone can sign a card naming this node.
- **`contact.own {key, own}` is the one thing that does**, declared in `spirit/contact/api.js` as
  `own: { key: 'key', own: 'bool' }`. `own: true` puts the star on, `own: false` takes it away. A key with no row, an `own`
  that is not a bool and a key of the wrong type are refused with a code. On a scratch node, over a raw POST.

## What its test must try to break

- A puppet made "mine" by its own card, or a star lost to one.
- A star set or kept by a refused call.
