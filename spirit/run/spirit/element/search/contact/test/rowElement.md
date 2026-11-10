# spirit/element/search/contact/rowElement.js

One contact as a row element: `spirit.element.search.contact.rowElement.create(row, options)` builds it through the shared
`rowElement.create` (`spirit/element/rowElement.js`). Its subject is a public key; it reads the node's contacts as the contact
family's cache manager keeps them (`spirit/run/spirit/contact/data.js`, `spirit.data.contact.data`; goal/G41.28:
in `spirit.data` under the serving node, `<node>/contact/contacts/<key>`), loads that manager itself
(`spirit.cacheManager('contact')`), and repaints from it. The test loads it as a page does, the page's node known
(`spirit.node.key`, `data.homeNode`).

## API

`create(row, options)`, options `{ open }`, row `{ key | publicKey, name, keep, mine, blocked, relay, present, url,
publicLabel }` → a row element `{ kind: 'contact', key, row, fields, actions, cells(), mount(hosts), apply(changes),
act(name, ctx), expandInfo(), destroy() }`, fields `presence, status, label, add, mark`.

## Requirements

- **Actions by what the row is**: a relay → `open` (its details by key); kept, mine or blocked → `open` (contact details
  by key), `block`, `unblock`, `remove` (`contact.block`, `contact.unblock`, `contact.forget`, by `publicKey`); anything
  else → `add` (`peer.acquire { publicKey, publicLabel }`). An action asks and paints nothing; an action the row does
  not offer asks nothing. **What the row is follows its flags**: a row added (its `keep` set on its contact row) loses
  its Add and offers what a kept row offers; a row that leaves the book offers Add again.
- **It loads what it uses** (goal/G41.3): loading, it requires `spirit/element/rowElement.js` through `spirit.require`; `open`
  first requires the one contact detail (`search/contact/detailElement.js`), for a person and a relay alike, then opens it, as a
  layer of the mounter's panel stack (`options.open`, goal/G43.18), handed `{ key, layer, relay }`: whether the row is a relay
  (goal/G43.32; Andy: *"the contact list already knows the difference between contact types. so should the detail panel."*), the layer's close and title,
  and no api (goal/G43.24: the details ask their verbs through the spirit object themselves).
- **Cells**: presence 🟢 present, 🔴 absent, ⚪ not known; status ❌ blocked over ⭐ mine, else blank; label
  the name, HTML-escaped; add an Add button only on a row neither in the book nor a relay; mark the glyph `options.mark(key)`
  answers, HTML-escaped, blank with none (goal/G43.32: the caller's mark, Chat's ⌛), repainted when the row is told `mark`.
- **Presence already known** in the contacts (`spirit.data.contact.data`) wins over the row's own `present` at create.
- **Dispatch**: one watch on the contacts (`spirit.data.contact.data.watch`); a write to a key repaints every live row of that key, only the fields
  whose values (or `from` values) changed. A destroyed row is no longer repainted.
- **Label editor**: normalizes and checks the name by `spirit.fieldRules` first; a refused name is answered
  `{ ok: false, error }` without asking; a good one asks `contact.label { publicKey, myLabel }`.
- **expandInfo**: a row in the book asks `contact.get { key }` once and keeps the answer; a row not in the book and a relay give
  `null` and ask nothing.

## What its test must try to break

Two rows of one key and one of another under one write; a flag that only the status draws from; a destroyed row; an
HTML name; a blank name; a relay that is also kept; acting a verb the row lacks; expanding twice; a row added while it is on the page, then taken out of the book.

## What the stream means for contacts (goal/G41.16)

The contacts' translation, `spirit/element/search/contact/data.js` until G41.16, then this element's, is since goal/G41.28 the contact
family's cache manager's (`spirit/contact/data.js`), which this element loads (Andy: *"get rid of thos FUCKING
data.js scripts, DIDN't WE INSIST on the PROPER way to do this shit?"*; G30.18: rowElements carry the listeners a subject
needs). The manager registers one translation with `spirit.data.addTranslator` as it loads; the element requires no data
script. It writes only through `merge`, `seat` and `del`.

- **relay-presence**: for each key in `data.presence` whose value is an object, the row's `present` becomes
  `proof.present === true`, written only when it changes. A key the table spoke of and no longer names goes back to
  not known (`present: undefined`), its row kept. An entry that is not an object writes nothing.
- **peer-search**: `data.item` ({ key, label: JSON }) is seated into its row by key, merged over what is there. An
  update with no item seats nothing; a label that is not JSON seats nothing.
- **contact.rename** `{ key, caption }`: the row's `name` becomes the caption as text, every other field kept; a key
  with no row gets one.
- **shadow** (the one table, goal/G40.11): `data.row` with a `publicKey` is merged into its row by key; `data.row.gone: true`
  lets the row go.
- Any other job type leaves the contacts alone.

Its test must also try to break: The same presence twice (no second write), a dropped key, garbage entries and labels, a rename of an unknown key, and
a foreign job carrying contact-shaped data.
