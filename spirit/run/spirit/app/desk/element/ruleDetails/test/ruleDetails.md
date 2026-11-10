# spirit/app/desk/element/ruleDetails/ruleDetails.js

One rule of the desk, as a dialog (goal/G6.4): its text, his draft, its chat, and the buttons that version it.
Activate and Delete are each one version of the rule with that status, both two-press. Since goal/G41.9 they are the
shell element armingButton (`spirit/element/armingButton.js`); the dialog keeps no arming of its own.

## Requirements

- It is the element `spirit.element.spirit.app.desk.element.ruleDetails.ruleDetails.create(container, { key, via })` (goal/G43.27, requirement 23), made
  in a layer over the Desk page, which hands it its own way to the node (`via`: `verb`, `escapeHtml`, `setScreenTitle`,
  `closeDialog`); it reads the rule (`desk.rule.get`) and its chat (`desk.item.chat`).
- **It loads `spirit/element/armingButton.js` itself**, through `spirit.require` (goal/G41.3).
- **Activate and Delete are arming buttons** (`armingButton.attach` or `create`), handed the app's api: `Activate`,
  armed `Activate: sure?`; `Delete`, armed `Delete: sure?`.
- **Their runs version the rule**: `desk.rule.version` with the rule's key, the text as it stands in the box, and the
  status `active` or `deleted`.
- **Version and Auto-attach stay plain buttons.**
- **Nothing hand-rolled is left**: no `data-armed`, no call to `armUntilElsewhere`, no `rdArmed`, no `armedButton`
  helper, no armed class.
- **The rule and its chat are the desk family's cache** (goal/G41.28; Andy: *"EVERY FUCKING ELEMENT is verified to make
  sure when it changes shit it listens to fucking update via the spirit object"*): it loads the desk manager
  (`spirit.cacheManager('desk')`), keeps `rule.get`'s answer in `spirit.data.desk.data.rules` and `item.chat`'s under the rule
  in its parts, and draws from `rules.watch` and `parts.watch`. It has no listener of its own on the desk's publishes.
- **A rule row changed in the cache repaints it**; the textbox keeps his typing, and is refilled only by the row that
  comes back after his Version (`rule.version`, the textbox as it stands), never by a draft come back. Version asks
  `rule.get` no more.
- **A line said under the rule** (`chat.add`) is not read back by the dialog itself: the `rule.chat` publish drops the
  chat kept, and the dropped chat is read again (`item.chat`) and drawn.

- **Its place** (goal/G43.30; Andy: "I'm fucking disappointed that you didn't put ruleDetail into run://spirit/app/desk/element/ when we moved desk!!!!!!!!!!!!!!"): `spirit/app/desk/element/ruleDetails/ruleDetails.js`, and Desk opens it from there, never from `shell/ruleDetails/`.
- **On the real page** (the box: "A test presses each one once on the real page and finds that nothing happened"): on a scratch node with desk on, a rule opened from Desk's Rules list opens this dialog; its Delete pressed once leaves the rule's status as it was, and stands armed.

## What its test must try to break

- A dialog loaded from shell/ruleDetails/; a Delete that deletes on its first press on the real page.

- Activate or Delete not an arming button, or with the wrong armed wording.
- Activate sending deleted, Delete sending active, or another rule's key.
- Version or Auto-attach made to arm.
- An armed flag, helper, `data-armed` or `armUntilElsewhere` left in the file.
- rule.get's or item.chat's answer not kept in the desk cache, or the dialog drawing from its own copy.
- A rule changed in the cache not repainted; his typing overwritten by a row that is not his version's, or by a draft.
- A read of its own after Version or Send; a dropped chat not read again.
