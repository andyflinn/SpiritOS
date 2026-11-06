# spirit/element/search/contact/listElement.js

The contacts list, a drop-in shell element: a pane in Contacts and Join, a dropdown in grants and introSpector. It is
a view of the node's contacts, the branch the contact family's cache manager keeps (`spirit.data.contact.data.branch`,
goal/G41.28), drawn by `probabilitySearch`, each row a `contactElement` (`contacts/rowElement.js`).

## API

`spirit.element.contactList = { create(host, opts) -> { list, refresh(), destroy() }, filters }`; opts `api`
(`peerPost`), `face`, `placeholder`, `all`, `pick(row, key)`, `say(text)`, `onAdded(row)`, `empty`.

## Requirements

- **show**: choices `all`, then `mine` (⭐ my puppets), `blocked` (❌), `held` (⌛), `relay` (relays), each only when a
  row of that kind is listed; buttons only when there is a kind; `all` or none passes every row, a kind only rows whose
  flag is exactly `true`.
- **network** (a toggle, last): a held row with no other flag (not kept, mine, blocked or a relay) shows only when on;
  every other row always.
- **named** (never a button): a row passes only with a name or as a relay; a bare presence is no row.
- **create** hands `probabilitySearch` `data: spirit.data.contact.data.branch`, these filters, columns presence, status, label, add, and
  refreshes once at once. Its search asks `contact.search { q }` with the text trimmed and answers `{ status: 200,
  body: { ok, items, more } }`, an empty answer an empty list. Rows are `contactElement`s by key; a row matches on name
  and public label.
- **Pressing a row**: kept → the element's `open`; held and undecided → `peerPost('', key, { card: true })`, saying
  the card, or that a different key answered.
- **A row's Add**: a click on a `[data-action]` inside a row runs that element's action, says `added <label>`, calls
  `onAdded`, searches again. A click on no button or a row the list did not make does nothing.
- **The one table is the contact family's cache** (goal/G41.28): the list subscribes to no stream of its own; a row
  the node's `shadow` job hands is in `spirit.data.contact.data`'s branch, the one the list hands its search.
- `refresh` and `destroy` are the search element's.
- **It loads what it uses** (goal/G41.3): loading, it requires `contacts/rowElement.js` and `probabilitySearch.js`
  through `spirit.require`, and no data script (goal/G41.16): what the stream means for contacts is the contact family's manager's.

## What its test must try to break

A flag that is truthy but not `true`; a held row that is also kept or a relay; a null row; an empty search answer; a
card from the wrong key; stray clicks; a subscription of its own to the stream.
