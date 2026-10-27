# shell/ruleDetails/ruleDetails.js

One rule of the desk, as a dialog (goal/G6.4): its text, his draft, its chat, and the buttons that version it.
Activate and Delete are each one version of the rule with that status, both two-press. Since goal/G41.9 they are the
shell element armingButton (`shell/js/armingButton.js`); the dialog keeps no arming of its own.

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api), open({ key }) })`; `open` reads the rule
  (`desk.rule.get`) and its chat (`desk.item.chat`).
- **It loads `shell/js/armingButton.js` itself**, through `spirit.require` (goal/G41.3).
- **Activate and Delete are arming buttons** (`armingButton.attach` or `create`), handed the app's api: `Activate`,
  armed `Activate: sure?`; `Delete`, armed `Delete: sure?`.
- **Their runs version the rule**: `desk.rule.version` with the rule's key, the text as it stands in the box, and the
  status `active` or `deleted`.
- **Version and Auto-attach stay plain buttons.**
- **Nothing hand-rolled is left**: no `data-armed`, no call to `armUntilElsewhere`, no `rdArmed`, no `armedButton`
  helper, no armed class.

## What its test must try to break

- Activate or Delete not an arming button, or with the wrong armed wording.
- Activate sending deleted, Delete sending active, or another rule's key.
- Version or Auto-attach made to arm.
- An armed flag, helper, `data-armed` or `armUntilElsewhere` left in the file.
