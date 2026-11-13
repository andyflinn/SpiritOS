# spirit/contact/data.js — its own test

What a client knows of a node's contacts, people and relays in one table (goal/G41.28, goal/G40.11), from the node's job
`spirit.contact` (goal/G43.20, Q1: *"presence, a search hit or a row, each event only its own"*). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs beside
the real `spirit/data.js`; the test reads through `spirit.data.contact.data` alone.

- In node, `spirit.cacheManager('contact')` finds it.
- The **presence table** sets each key's `present`; a key the table drops goes back to not known (`present`
  undefined).
- A **search hit** the network found is seated as a row; a **row of the one table** is merged in by its public key, and
  let go when `gone`. A **rename** sets the contact's name from its caption. A job of another id keeps nothing.
- Reads: `contact(key)` (null for no key), `contacts()`, `watch(fn)` (key and row, undefined once gone; its release),
  `branch` under the node that served it. Another node's rows are filed under that node.

## What its test must try to break

- A dropped key left present; a gone row kept; a rename lost; a row of another job's data taken; two nodes mixed.
