# shell/js/contacts/data.js

Contacts' translator: what the stream means for `data.contacts` in the faceless layer (`shell/js/spiritData.js`). It
registers one translator with `spirit.data.translate` and writes only through `merge` and `seat`. It runs in node too.

## Requirements

- **relay-presence**: for each key in `data.presence` whose value is an object, the row's `present` becomes
  `proof.present === true`, written only when it changes. A key the table spoke of and no longer names goes back to
  not known (`present: undefined`), its row kept. An entry that is not an object writes nothing.
- **peer-search**: `data.item` ({ key, label: JSON }) is seated into its row by key, merged over what is there. An
  update with no item seats nothing; a label that is not JSON seats nothing.
- **contact.rename** `{ key, caption }`: the row's `name` becomes the caption as text, every other field kept; a key
  with no row gets one.
- Any other job type leaves `data.contacts` alone.

## What its test must try to break

The same presence twice (no second write), a dropped key, garbage entries and labels, a rename of an unknown key, and
a foreign job carrying contact-shaped data.
