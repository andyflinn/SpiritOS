# shell/rotateKey/rotateKey.js

The Rotate key dialog (cycle-10/R13), opened from Info: what rotating the cipher key does and costs, then one button
that does it. A crisis measure, so the button is two-press (Andy: "it must be made available in a portion of the UI
with the are-you-sure mechanism"). Since goal/G41.9 that button is the shell element armingButton
(`shell/js/armingButton.js`); the dialog keeps no arming of its own.

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api), open() })`; every `open` starts with no old
  result.
- **It loads `shell/js/armingButton.js` itself**, through `spirit.require` (goal/G41.3).
- **Rotate is an arming button** (`armingButton.attach` or `create`): it says `Rotate the key`, armed
  `Rotate the key: press again`, and is handed the app's api, so a click elsewhere disarms it.
- **Its run asks `node.rotateCipher`** once, and the dialog then says what the node answered (the card's number and
  how many relays it went to), or its refusal.
- **Nothing hand-rolled is left**: no `data-armed`, no call to `armUntilElsewhere`, no `rkArmed`, no armed class.

## What its test must try to break

- A Rotate that is not an arming button, or one that loses today's armed wording.
- A run that does not rotate, or rotates before it is asked.
- An armed flag, `data-armed` or `armUntilElsewhere` left in the file.
