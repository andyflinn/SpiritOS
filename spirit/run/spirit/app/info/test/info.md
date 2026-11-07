# shell/info/info.js

The Info app (goal/G40.10; goal/G41.6): what this node says about itself to anybody who asks, its name and its
description; the two relay forms (an email, a face name on one relay); and the key rotation. Intrinsic, on the coded list
in `spirit/run/spirit/coreFiles.js`, so every face shows it.

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api) })`.
- **It loads what it uses itself** (goal/G41.3), through `spirit.require`: `spirit/element/changeMyLabel.js`,
  `spirit/element/changeMyDescription.js`, `spirit/element/joinForm.js` and `spirit/element/faceForm.js`.
- **Its two blocks are the two shell elements** (Andy, Q1): changeMyLabel for the name, changeMyDescription for the
  description, each handed the app's api. Info reads `node.card` and keeps its answer in the node family's cache
  (`spirit.cacheManager('node')`, then `spirit.data.node.data.card.keep`; goal/G41.28); each element draws itself from that
  card and holds its own rule, check, limit and save.
- **"What each relay calls you" is dropped** (Andy, 2026-10-27): no table of relays and the name each calls this node,
  no push of a saved name to every relay, no rename. Its code is tested gone.
- **The two forms stay**: the email form and the face form, each over the relays this node holds a seat on
  (`spirit.relay.status`, a row claimed or owned whose roll names the relay's key), as it is drawn. A relay's row
  changing in the contact family's cache is the two forms' to follow, reading nothing (goal/G41.32).
- **The key rotation is a rowForm** (goal/G41.27; Andy: *"Info App\n\n[🆘] [Rotate this node's cipher key]"*): it loads
  `spirit/element/rowForm.js` itself and makes one rowForm, its icon 🆘 and its button `Rotate this node's cipher key`, its
  span empty, and no Rotate button of its own. Its button opens the Rotate key page (`shell/rotateKey`); nothing here
  rotates a key itself.

## What its test must try to break

- The relay table, its words, the push or the rename left in the file.
- A field drawn by Info itself instead of by its element.
- node.card's answer not kept in the node card.
- A saved name posted to a relay.
- The forms offered a relay this node holds no seat on.
