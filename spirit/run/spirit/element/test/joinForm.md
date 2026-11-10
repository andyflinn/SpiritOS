# spirit/element/joinForm.js, its form

The join form, a rowForm, in its modes (goal/G41.27). Its test is `./joinForm.js`. Join, Info and the relay details
draw it by mount (goal/G40.10: *"the SAME FUCKING FORM EVERYWHERE"*).

It escapes what it draws with `spirit.escapeHtml` itself (goal/G43.24; Andy: *"every element that accesses ANY api must
require them themselves"*): no escape is handed to it, and a mounter hands only its relays and its own options.

Andy, on G41.27: *"joinForm? it has several modes:\n\nsuggestions?"*, then *"wsl, agreed."* to these:

- Join (no seat): `[➕] [relay ▾] [email] [Join]`
- Change (seated): `[✏️] [relay ▾] [email] [Change]`
- Fixed (relay details): the same, the dropdown fixed to its one relay.
- The icon follows the mode, as the words do. The words Relay and Your email go. The title stays above the bubble, the
  sent line below.

Whether the form changes its icon and button in place or is drawn again when the mode changes is the builder's: the
test asks only what is seen after a pick.

Asked of a real browser, the real rowForm composed: `./joinForm-laid.html`, opened at
`/DEBUG/spirit/element/test/joinForm-laid.html` on a scratch node with its DEBUG on (`spirit/test/headLessChrome.js`), two relays
(Alpha with no seat, Beta seated), the form mounted on both, then on Beta fixed.

## Requirements

- **It loads the rowForm itself** (rule/26).
- **Join**, Alpha picked: one rowForm on the page in its box, ➕ and Join; its span the relay dropdown, then the email
  input, and nothing else; no Relay or Your email in the bubble; the title Join a relay above the bubble; Join the only
  such button.
- **Change**, Beta picked in the dropdown: the same, now ✏️ and Change, the title Change email address.
- **Fixed** to Beta: ✏️ and Change; the dropdown holds Beta alone and is fixed.
- **A press**, the email empty: the line saying why stands below the bubble, not in it.

## What its test must try to break

- A form of its own instead of a rowForm; an icon that does not follow the mode; the words left in the bubble.
- More than the dropdown and the email in the span; the title in the bubble, or the line of what was sent.
