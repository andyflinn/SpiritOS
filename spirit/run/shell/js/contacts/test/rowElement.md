# shell/js/contacts/rowElement.js

One contact as a row element: `spirit.elements.contactElement.create(row)` builds it through the shared
`rowElement.create` (`shell/js/rowElement.js`). Its subject is a public key; it reads `data.contacts` of the faceless
layer (`shell/js/spiritData.js`) and repaints from it.

## API

`contactElement.create(row)`, row `{ key | publicKey, name, keep, mine, blocked, held, relay, present, url,
publicLabel }` → a row element `{ kind: 'contact', key, row, fields, actions, cells(), mount(hosts), apply(changes),
act(name, ctx), expandInfo(), destroy() }`, fields `presence, status, label, add`.

## Requirements

- **Actions by what the row is**: a relay → `open` (its details by url); kept, mine or blocked → `open` (contact details
  by key), `block`, `unblock`, `remove` (`contact.block`, `contact.unblock`, `contact.forget`, by `publicKey`); anything
  else → `add` (`peer.acquire { publicKey, publicLabel }`). An action asks and paints nothing; an action the row does
  not offer asks nothing.
- **Cells**: presence 🟢 present, 🔴 absent, ⚪ not known; status ❌ blocked over ⌛ held over ⭐ mine, else blank; label
  the name, HTML-escaped; add an Add button only on a row neither in the book nor a relay.
- **Presence already known** in `data.contacts` wins over the row's own `present` at create.
- **Dispatch**: one watch on `data.contacts`; a write to a key repaints every live row of that key, only the fields
  whose values (or `from` values) changed. A destroyed row is no longer repainted.
- **Label editor**: normalizes and checks the name by `spirit.fieldRules` first; a refused name is answered
  `{ ok: false, error }` without asking; a good one asks `contact.label { publicKey, myLabel }`.
- **expandInfo**: a row in the book asks `contact.get { key }` once and keeps the answer; a held row and a relay give
  `null` and ask nothing.

## What its test must try to break

Two rows of one key and one of another under one write; a flag that only the status draws from; a destroyed row; an
HTML name; a blank name; a relay that is also kept; acting a verb the row lacks; expanding twice.
