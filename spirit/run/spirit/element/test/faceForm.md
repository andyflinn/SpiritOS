# spirit/element/faceForm.js, its form

The face form, a rowForm (goal/G41.27). Its test is `./faceForm.js`. Join, Info and the relay details draw it by mount
(goal/G40.10).

It escapes what it draws with `spirit.escapeHtml` itself (goal/G43.24; Andy: *"every element that accesses ANY api must
require them themselves"*): no escape is handed to it, and a mounter hands only its relays and its own options.

Andy, on G41.27: *"faceForm:\n\n[❓] [Relay▾][Face-name-input][Ask-button]"*. The box: *"a line saying what a press did
(a refusal, a result) is the mounter's, below the bubble, not in it."*

Asked of a real browser, the real rowForm composed: `./faceForm-laid.html`, opened at
`/DEBUG/spirit/element/test/faceForm-laid.html` on a scratch node with its DEBUG on (`spirit/test/headLessChrome.js`), three relays
(Alpha with no seat, Beta seated with a face name, Gamma owned), the form mounted on them, then fixed to Gamma.

## Requirements

- **It loads the rowForm itself** (rule/26).
- **One rowForm**, its icon ❓ and its button Ask.
- **Its span holds the relay dropdown, then the face name input**, and nothing else; the dropdown offers the relays this
  node is seated on and has starred (Beta, Gamma; not Delta, seated with no star), or, fixed, its one relay, disabled.
- **The words Relay and Face name are gone** from the bubble.
- **Its title**, A face name on one relay, stands above the bubble; **what this node holds** on the relay stands below
  it, not in it.
- **Its Ask is the rowForm's button**, the only one.
- **A face only on a starred relay** (goal/G43.18, box v29: *"At home, faceForm offers a face only on a starred relay"*, turning round G41.32's "not starred"): `offers` answers true for a seated relay with the star and false for one without.
- **With no relay this node is seated on and has starred, it draws nothing** (Andy: *"doesn't show up if the user has zero verified
  emails anywhere"*); this was asked of the old markup in `spirit/test/spiritInUse.js` until goal/G41.27.
- **A press with no face name** says so on a line below the bubble, not in it.

## What its test must try to break

- A form of its own instead of a rowForm; another icon or button; the words left in the bubble.
- More than the dropdown and the name in the span; the title, the holding line or the answer inside the bubble.
