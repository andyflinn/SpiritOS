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
- **The door and its run are the desk family's cache** (goal/G41.28; Andy: *"EVERY FUCKING ELEMENT is verified to make
  sure when it changes shit it listens to fucking update via the spirit object"*): it loads the desk manager
  (`spirit.cacheManager('desk')`), keeps the plugin's door read in `spirit.deskData.doors` and its runState read in
  `doorRuns`, and draws both from their watches: a door or a run changed in the cache is drawn. It sets no listener of
  its own on the desk's publishes.
- **What the plugin says changed is read again**: its publish for this door drops the run kept, and for any change but
  a run the door too; each dropped row is read again. Another door's publish reads nothing.
- **Save reads nothing back itself**: it sends the door as its form says it (`stackFrameChecks.update`, then each path
  and suite), says Saved, and its cleared run comes back when the plugin's publish drops it.

## What its test must try to break

- Remove not an arming button, or with the wrong armed wording.
- A run that removes another door, or does not close the dialog.
- Save or Run made to arm.
- An armed flag, `data-armed` or `armUntilElsewhere` left in the file.
- A door or run read not kept in the desk cache, or drawn from a copy of its own.
- A row the plugin's publish dropped not read again, or another door's publish read as this one's.
- A run read of its own after Save, or a listener of its own on the desk's publishes.
