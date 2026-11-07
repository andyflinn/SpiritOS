# spirit/element/changeMyDescription.js

The node's description, changed (goal/G41.6; Andy, Q1: its two blocks "become shell elements of their own, each with
its test folder"): one shell element, the Description field, its Save and the bytes left. Info draws it.

## Requirements

- A shell element of its own: it adds `changeMyDescription.create(host)` to
  `window.spirit.element`, and answers `{ set(value), destroy() }`.
- **It loads fieldInput itself**, through `spirit.require` (goal/G41.3).
- **Its form is a rowForm** (goal/G41.27; Andy: *"changeMyDescription:\n\n[✏️][Description-input][Save]"*): it loads
  `spirit/element/rowForm.js` itself and makes one rowForm in its host, its icon ✏️ and its button Save; its span holds the
  description input alone, no word beside it; the rowForm's button is its Save, and it draws no Save of its own; its
  bytes left and its message stand below the bubble, not in it.
- **Its input is marked with its rule** (rule/12): `data-field="description"`, held at the description rule's byte
  limit by `fieldInput.attach(input, 'description')`, with the bytes left beside it (`fieldRules.describeRemaining`),
  counted in bytes as typed.
- DISCREPANCY WITH ANDY's RULES: goal/G41.27's box (v8) says *"character counters outside a form go: a field is limited
  by fieldRules.js as it is typed, so a counter says nothing"*; this element still draws the bytes left below the
  bubble, outside the form, and its test asserts it.
- `set(value)` puts what the node stored in the field.
- **Save is refused while the rule says no** (`fieldRules.describeProblem`), and the field says why; nothing goes on
  the wire.
- **Save asks the node**, `node.setDescription` with the field as typed, through the spirit object itself, no api handed (goal/G43.24), and then shows what the node stored (rule/19),
  says saved, and keeps the stored description in the node card. Enter in the field saves as Save does.
- **What it changes, it listens for** (goal/G41.28): it loads the node family's cache (`spirit.cacheManager('node')`)
  and draws the field from `spirit.data.node.data.card.watch`; a description changed in the card from elsewhere redraws the
  field.
- A refusal from the node is said beside the field; the field keeps what was typed.

## What its test must try to break

- The input not marked or not held at its limit.
- The bytes left counted in characters, not bytes.
- A description past its limit sent to the node.
- The field showing what was typed instead of what was stored.
- A form of its own instead of a rowForm, another icon or button, a word or more beside the input in its span, or its
  message inside the bubble.
