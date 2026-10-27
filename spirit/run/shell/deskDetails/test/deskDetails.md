# shell/deskDetails/deskDetails.js

An item's details page in the Desk app: the box, the suites, the red Qs, the blocks, the files and the rules, each a
panel behind an icon on its left strip. This test covers what goal/G41.1 (box v19-v20) requires of it.

## Requirements (goal/G41.1)

- **Icons are glyphs** (Andy: the icon set is the only source of icons on the face; `spirit/client/iconIndex.js`
  deleted): each panel of `DD_PANELS` names its icon as the glyph itself, and the strip draws it as it is.
- It reads no icon table (`iconIndex`, `ICON`).

## What its test must try to break

- A panel icon given as a key, drawn as `undefined` once the table is gone.

## Requirements (goal/G41.9)

Every are-you-sure in the dialog is an armingButton (`shell/js/armingButton.js`; Andy, Q1: "absolutely"), in place of
the arming deskDetails.js hand-rolled.

- **It loads armingButton itself**, through `spirit.require('shell/js/armingButton.js')`.
- **Nothing hand-rolled is left**: no `data-armed`, no `armUntilElsewhere`, no armed flag of its own (`ddArmed`,
  `ddDisarm`, `armedClose`, `armedAll`).
- **Each two-press button is an armingButton handed the app's api**, saying today's armed wording; its first press
  writes nothing, its second writes as before:
  - Done not verified green → `Done anyway: sure?`, then `press done`;
  - Go all → `Go all: sure?`, then `press go-all`; Waive → `Waive: sure?`, then `press waive`;
  - Delete → `Delete: sure?`, then `item.delete`; Abandon → `Sure? Abandon the goal`, then `press abandon`;
  - an early Close → `are you sure? N open` on a goal with N items open, `Close: sure?` on an open item, then `press close`;
  - Grant G<n> → `Grant G<n>: sure?`, Grant all N → `Grant all N: sure?`, then `check.set` granted.

## What its test must try to break (goal/G41.9)

- A button armed by the dialog itself rather than by armingButton; a first press that already writes; an armed
  wording lost; a grant or close sent on one press.

## Requirements (goal/G41.11)

Andy, in the box: "the remove button for red Q's must ask: are-you-sure?", "the start-design and end-design buttons in an
item must ask: are-you-sure", "the rename input field on goal/item detail panel MUST contain the current title when it's
first displayed."

- **A red Q's remove** (the red Qs panel, `data-qclear`) is an armingButton: the first press arms it and sends nothing,
  the second sends his clear (`chat.add` with `<Q>: clear`).
- **Start design and End design** in the details panel (`dd-start-design`, `dd-end-design`) are armingButtons: the
  first press arms, the second presses `start-design` / `end-design`.
- **Rename** opens its field (`dd-name`) holding the current title of the goal or item; Save sends the title as edited.

## What its test must try to break (goal/G41.11)

- A red Q cleared, or design started or ended, on one press; the remove or a design button not made by armingButton.
- A rename field that opens empty, on an item or a goal.
