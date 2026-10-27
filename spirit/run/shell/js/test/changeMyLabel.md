# shell/js/changeMyLabel.js

The node's name, changed (goal/G41.6; Andy, Q1: its two blocks "become shell elements of their own, each with its test
folder"): one shell element, the Name field and its Save. Info draws it; anything else that lets the owner rename
this node may.

## Requirements

- A shell element of its own: it adds `changeMyLabel.create(host, { api, onSaved })` to `window.spirit.elements`, and
  answers `{ set(value), destroy() }`.
- **It loads fieldInput itself**, through `spirit.require` (goal/G41.3).
- **Its input is marked with its rule** (rule/12): `data-field="label"`, held at the name rule's byte limit by
  `fieldInput.attach(input, 'name')`, with the bytes left beside it, counted in bytes as typed (`fieldRules.MAX_BYTES`).
- `set(value)` puts what the node stored in the field.
- **Save is refused while the rule says no** (`fieldRules.problem`), and the field says why; nothing goes on the wire.
- **Save asks the node**, `node.setName` with the field as typed, and then shows what the node stored (rule/19), says
  saved, and tells `onSaved(name)`. Enter in the field saves as Save does.
- A refusal from the node is said beside the field; the field keeps what was typed.

## What its test must try to break

- The input not marked or not held at its limit.
- The bytes left counted in characters, not bytes.
- An invalid name sent to the node.
- The field showing what was typed instead of what was stored.
