# The rotate key dialog, an element over Info

goal/G43.24, requirement 8. Its test is `./nodeInfoRotate.js`: the tree read as it is, then a real node on a scratch copy of the tree's files (tracked and new, not ignored) and real clicks in a real Chrome on `/face.html`, Info opened from its tile in the shell app. No key is rotated: the page's `node.rotateCipher` is replaced by a recorder that refuses, and the node's card is compared before and after. The dialog's own test moves to `./rotateKey.js`; this one judges the move and the opening.

Andy, on "Info's rotate button opens the old shell's dialog": *"not good."* *"do it right!"* And: *"it's just a panel that opens exactly overtop of the calling panel, new-shell-style."*, *"like fstat"*.

## Requirements

### The move

- `shell/rotateKey/` is gone; coreFiles.js's INTRINSIC list has no `shell/rotateKey`; no code (comments and tests out) opens `shell/rotateKey`.
- Its test is in the element's test folder: `spirit/element/test/rotateKey.js` and `.md`.
- `spirit/element/rotateKey.js` is there and mounts the new shell's way (requirement 7): no `spirit.shell.activateApp`; `spirit.elements.rotateKey.create(container, opts)` answers `{ destroy() }`.
- nodeInfo opens no dialog of the old shell: no `callDialog` in `spirit/element/nodeInfo.js`.

### Its explanation and its two-press button, as they are

- The element alone draws the explanation of shell/rotateKey/rotateKey.js at 4f01465b, word for word, and its button, Rotate the key.
- One press arms it (`data-armed`, *Rotate the key: press again*), and asks no `node.rotateCipher`.

### Over Info, through panel.js

- Info's Rotate this node's cipher key opens the dialog: its explanation shows and Info's name and description fields are out of view.
- *"like fstat"*: as file opens fstat, over all of the one that opens it, its bar too (the file suite's "one bar in view"): one bar in view, not Info's, and one panel.js close (`.app-container-close`) in view.
- The layer shows Rotate the key; one press arms it and rotates nothing.
- Its ✕ shows Info again, the dialog out of view, and Info's bar is the one in view again.
- The node's card is as it was.
