# spirit/element/changeMyDescription.js

The node's description, changed (goal/G41.6; Andy, Q1: its two blocks "become shell elements of their own, each with
its test folder"): one shell element, the Description field and its Save. Info draws it.

## Requirements

- A shell element of its own: it adds `changeMyDescription.create(host)` to
  `window.spirit.element`, and answers `{ set(value), destroy() }`.
- **It loads fieldInput itself**, through `spirit.require` (goal/G41.3).
- **Its form is a rowForm** (goal/G41.27; Andy: *"changeMyDescription:\n\n[✏️][Description-input][Save]"*): it loads
  `spirit/element/rowForm.js` itself and makes one rowForm in its host, its icon ✏️ and its button Save; its span holds the
  description input alone, no word beside it; the rowForm's button is its Save, and it draws no Save of its own; its
  message stands below the bubble, not in it.
- **Its input is marked with its rule** (rule/12): `data-field="description"`, held at the description type's byte
  limit by `fieldInput.attach(input, 'spirit.type.string.description')`.
- **No counter outside the form** (goal/G41.27's box v8; Andy: *"those fucking character counter OUTSIDE the fucking form
  ... they ALL have to go"*): outside the rowForm it draws its message and nothing else.
- `set(value)` puts what the node stored in the field.
- **Save is refused while the description type says no** (`spirit/type/string/description.js`, its `isValid`,
  goal/G48.4: "fieldRules.js dies"), and the field says why; nothing goes on the wire.
- **Save asks the node**, `node.setDescription` with the field as typed, through the spirit object itself, no api handed (goal/G43.24), and then shows what the node stored (rule/19),
  says saved, and keeps the stored description in the node card. Enter in the field presses Save. Its Save is handed to the rowForm as `press` (goal/G47.1, Q20; Andy: *"mark the button busy from press until the mounter's answer comes"*): the press settles only once the node has answered, so the button is busy until then.
- **What it changes, it listens for** (goal/G41.28): it requires the node family's interface (`spirit.require('spirit/node/api.js')`), which brings its data.js, and no
  data script itself (goal/G47.1),
  and draws the field from `spirit.data.node.data.card.watch`; a description changed in the card from elsewhere redraws the
  field.
- A refusal from the node is said beside the field; the field keeps what was typed.

## What its test must try to break

- The input not marked or not held at its limit.
- A counter drawn outside the form.
- A description past its limit sent to the node.
- The field showing what was typed instead of what was stored.
- A form of its own instead of a rowForm, another icon or button, a word or more beside the input in its span, or its
  message inside the bubble.
