# shell/stackFrameCheckDetail/stackFrameCheckDetail.js

One stack-frame door, as a dialog (goal/G27.2): its fields, Save, Run, Remove, its last run and its item's chat. A door
is deleted here alone: Remove, armed by its first press and sent by the second (D7). Since goal/G41.9 Remove is the
shell element armingButton (`shell/js/armingButton.js`); the dialog keeps no arming of its own.

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api), open({ id }) })`; `open` reads the door
  (`desk.stackFrameChecks.door`) and its run (`desk.stackFrameChecks.runState`).
- **It loads `shell/js/armingButton.js` itself**, through `spirit.require` (goal/G41.3).
- **Remove is an arming button** (`armingButton.attach` or `create`), handed the app's api: `Remove`, armed
  `Remove: sure?`.
- **Its run removes the door**: `desk.stackFrameChecks.remove` with this door's id, then the dialog closes with
  `closeDialog({ removed: id })`.
- **Save and Run stay plain buttons.**
- **Nothing hand-rolled is left**: no `data-armed`, no call to `armUntilElsewhere`, no `sdArmed`, no armed class.

## What its test must try to break

- Remove not an arming button, or with the wrong armed wording.
- A run that removes another door, or does not close the dialog.
- Save or Run made to arm.
- An armed flag, `data-armed` or `armUntilElsewhere` left in the file.
