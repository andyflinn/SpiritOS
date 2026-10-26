# shell/js/contactLabel.js

The contact label: a contact's name by key, as a shell element (`spirit.elements.createContactLabel`). What it shows
is the node's caption for the key, never a rule of its own.

## API

`createContactLabel({ key, caption?, editable?, className? })` → a `span.contact-label` (`contact-label-editable` in
mode 2, the caller's class added), holding `span.contact-label-text` and `span.contact-label-error`.

## Requirements

- **One name per key for the page**: a caption given or answered is known to every later label of that key. With no
  caption it asks `contact.get { key }`, one ask per key however many labels wait, and shows blank (never the key)
  until answered. No name in the answer, or a failed ask, shows the key; such a key is asked again by the next label.
- **Renames, both modes**: a `contact.rename` event on document with `detail { key, caption }` redraws every label of
  that key and is known to later ones; a detail without a text caption is ignored. A label that was on the page and
  left it removes its listener at the next rename; one never placed keeps listening.
- **Mode 1** (display): no click.
- **Mode 2** (editable): a click opens one `input.contact-label-input` holding the caption, before the error span,
  the text hidden; Escape closes it. Enter saves: an empty name asks nothing; a name `spirit.fieldRules.problem`
  refuses is said in the error span and not asked; otherwise `contact.label { publicKey, myLabel }` with the name
  trimmed. The answer's caption (or the name typed, if it has none) is drawn and known, the input closed, the error
  cleared; a refusal is said and the old name kept.

## What its test must try to break

Two labels of one key before the answer; a key the book cannot name; a failing ask; a rename of another key or with a
non-text caption; a label that left the page; double clicks; blank, too long and refused names; an answer with no
caption.
