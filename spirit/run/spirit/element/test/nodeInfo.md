# spirit/element/nodeInfo.js

What this node says about itself, an element (goal/G43.24, requirement 6; Q2, Andy: *"nodeInfo is fine."*): all of Info.
The Info app is its wrapper (`spirit/app/info/element.js`, Andy: *"no i want those apps to basically be wrappers for
spirit/element/ things...."*). Its test is `./nodeInfo.js`, the one test file of nodeInfo.js; the rotate key dialog opening over Info on a real page is
judged in its rotate part (once `./nodeInfo-rotate.js`), the sections below.

## Requirements

- **Mounted the new shell's way**: it sets `spirit.elements.nodeInfo = { create(container, { open }) -> { ready,
  destroy() } }`. `ready` settles once the card is read and kept (or said refused). No `spirit.shell.activateApp`, no
  `callDialog` of the old shell.
- **It loads what it uses itself** (rule/26), through `spirit.require`: `spirit/element/changeMyLabel.js`,
  `changeMyDescription.js`, `joinForm.js`, `faceForm.js`, `rowForm.js` and `panel.js`; `spirit/element/rotateKey.js` only
  when the dialog is opened. A part refused, it says *Info could not be loaded.*
- **What it needs, it gets itself** (Andy: *"every fucking element gets the interfaces it needs"*): the spirit object's
  families (`spirit.node.card`, `spirit.relay.status`, through `spirit.ready` and `spirit.outcome`); no api, no
  `api.verb`, no `peerPost`.
- **The page**: it empties its container and draws one fill box: the heading *What this node says about itself*, the
  note *Anybody who asks this node is told these two things, whether or not you have ever met. Nothing else about this
  box is answered to a stranger.*, then a slot each for the name, the description, what it says, the email form, the face
  form and the rotate row.
- **Its two fields are the two elements** (goal/G41.6): changeMyLabel in the name slot, changeMyDescription in the
  description slot, each made with its container alone (no api handed); each holds its own rule, check and save.
- **The card**: it loads the node family's cache manager (`spirit.cacheManager('node')`), asks `spirit.node.card({})`
  once and keeps the answer in `spirit.data.node.data.card` (goal/G41.28), from which each field draws itself. A refusal
  is said in the node's words and nothing is kept; no answer is said as *node.card did not answer*.
- **No key is shown** (goal/G40.10; Andy: *"remove ANY indication of keys from all user interfaces"*): neither the
  node's nor a relay's.
- **The two forms**: the email form (`joinForm.mount`) above the face form (`faceForm.mount`), each in its slot, over the
  relays this node holds a seat on: from `spirit.relay.status('')`, only a row claimed or owned whose roll names the
  relay's key. The email form picks among them (`pick: 'seated'`); neither is handed an escape (each escapes with
  `spirit.escapeHtml` itself, goal/G43.24); the face form is
  handed a `reload` that asks relay.status again and draws both forms again. The relays land when they land: the fields
  and the card do not wait for them. relay.status refused, both forms are drawn over no relay and nothing throws.
- **"What each relay calls you" is dropped** (Andy, 2026-10-27): no relay table, no push of a saved name to every relay,
  no rename.
- **Nothing ticks**: no timer; nothing changes without this element asking.
- **The key rotation is a rowForm** (goal/G41.27; Andy: *"[🆘] [Rotate this node's cipher key]"*): one, in the rotate
  slot, its icon 🆘, its button `Rotate this node's cipher key`, its span empty; no button of its own. Pressing it rotates
  nothing; it opens the rotate key dialog (`spirit/element/rotateKey.js`) as a layer over Info (Andy: *"it's just a panel
  that opens exactly overtop of the calling panel, new-shell-style."*, *"like fstat"*), key `rotateKey`, 🆘 and the
  label *Rotate this node's cipher key*:
  - through the mounter's stack, `opts.open(key, spec)`, when it is handed one; it then makes no stack of its own;
  - otherwise through its own panel.js stack, `spirit.elements.panel.create(its box, its page)`, so the layer covers all
    of Info and its ✕ shows Info again.
  The layer's fill loads rotateKey.js and makes `spirit.elements.rotateKey.create(pane, {})` in the layer's pane,
  answering it to destroy; a layer closed before that loads gets nothing made.
- **destroy()** destroys both fields, both forms (each made once by its `create`, then handed the relays again by its
  `mount`; each holds a contact watch, rule/8) and its own stack (the dialog with it) and empties its container. A card or relays
  that land after destroy keep nothing and draw nothing.

## What its test must try to break

- A field drawn by nodeInfo itself, or handed an api.
- node.card's answer not kept in the node card, or kept after destroy, or a refusal not said.
- A form offered a relay this node holds no seat on, or the fields waiting on the relays.
- A key shown anywhere.
- A rotate button that rotates, opens the old shell's dialog, opens outside the mounter's stack when handed one, or
  makes its own stack beside the mounter's.
- The relay table, the push or the rename back in the file; a timer.

## Info's two relay forms

goal/G43.27, requirements 9 and 10, the forms part of `spirit/run/spirit/element/test/nodeInfo.js` (once `nodeInfo-forms.js`).

Andy: "setting a star on a relay is what makes the face-form appear in \"info\", the email form must always show in \"info\"".

nodeInfo.js runs on a bare window, with the real joinForm.js and faceForm.js. The rowForm is a stand-in. relay.status answers as the relay family's own `status` does: `{ status, text, body: { rows, ... } }`. Its rows are a seat on A (claimed), one on O (owned), and B, which is only listed. A star is a row's `mine`, the field faceForm reads (faceForm.js:33).

### Requirements

- **9. The email form always shows.**
  - It shows with seats and no star.
  - It shows with A starred.
  - It shows with no seat on any relay.
- **10. The face form only for a starred relay.**
  - With no relay starred, there is no face form.
  - With A starred, the face form shows, and it offers A alone.

## spirit/element/nodeInfo.js: all of Info in one element

goal/G43.24, requirement 6. Its test is the parts part of `./nodeInfo.js` (once `./nodeInfo-parts.js`): nodeInfo.js read as it is, comments stripped.

Andy: *"i just moved them, didn't fix the manifest."*, *"no i want those apps to basically be wrappers for spirit/element/ things...."*, and *"box that these apps must mount in the new format of the new shell."*

### Requirements

- Info's own parts move into `spirit/element/nodeInfo.js` (Q2: *"nodeInfo is fine."*): it is there, it asks relay.status and node.card, and it draws the rotate button.

## The rotate key dialog, an element over Info

goal/G43.24, requirement 8. Its test is the rotate part of `./nodeInfo.js` (once `./nodeInfo-rotate.js`): the tree read as it is, then a real node on a scratch copy of the tree's files (tracked and new, not ignored) and real clicks in a real Chrome on `/face.html`, Info opened from its tile in the shell app. No key is rotated: the page's `node.rotateCipher` is replaced by a recorder that refuses, and the node's card is compared before and after. The dialog's own test moves to `./rotateKey.js`; this one judges the move and the opening.

Andy, on "Info's rotate button opens the old shell's dialog": *"not good."* *"do it right!"* And: *"it's just a panel that opens exactly overtop of the calling panel, new-shell-style."*, *"like fstat"*.

### Requirements

#### The move

- `shell/rotateKey/` is gone; coreFiles.js's INTRINSIC list has no `shell/rotateKey`; no code (comments and tests out) opens `shell/rotateKey`.
- Its test is in the element's test folder: `spirit/element/test/rotateKey.js` and `.md`.
- `spirit/element/rotateKey.js` is there and mounts the new shell's way (requirement 7): no `spirit.shell.activateApp`; `spirit.elements.rotateKey.create(container, opts)` answers `{ destroy() }`.
- nodeInfo opens no dialog of the old shell: no `callDialog` in `spirit/element/nodeInfo.js`.

#### Its explanation and its two-press button, as they are

- The element alone draws the explanation of shell/rotateKey/rotateKey.js at 4f01465b, word for word, and its button, Rotate the key.
- One press arms it (`data-armed`, *Rotate the key: press again*), and asks no `node.rotateCipher`.

#### Over Info, through panel.js

- Info's Rotate this node's cipher key opens the dialog: its explanation shows and Info's name and description fields are out of view.
- *"like fstat"*: as file opens fstat, over all of the one that opens it, its bar too (the file suite's "one bar in view"): one bar in view, not Info's, and one panel.js close (`.app-container-close`) in view.
- The layer shows Rotate the key; one press arms it and rotates nothing.
- Its ✕ shows Info again, the dialog out of view, and Info's bar is the one in view again.
- The node's card is as it was.
