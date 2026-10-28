# shell/desk/desk.js

The Desk app's page: the List of goals and items, the rules, the group chat. This test covers what goal/G41.1
(box v19-v20) requires of it.

## Requirements (goal/G41.1)

- **Icons are glyphs** (Andy: the icon set is the only source of icons on the face; `spirit/client/iconIndex.js`
  deleted): every icon desk.js draws is written as the glyph itself: a goal's 📁, an item's ❌ while it asks Andy and
  💻 otherwise, the battle mark ⚔️, and a rule's status (proposed ✏️, active 🔒, deleted 💀).
- It reads no icon table (`iconIndex`, `ICON`) and has no lookup of a name into one (`deskIcon`).

## What its test must try to break

- An icon looked up by key, drawn as nothing once the table is gone.

## Requirements (goal/G41.9)

Every are-you-sure on the page is an armingButton (`shell/js/armingButton.js`; Andy, Q1: "absolutely"), in place of
the arming desk.js hand-rolled.

- **It loads armingButton itself**, through `spirit.require('shell/js/armingButton.js')`.
- **Nothing hand-rolled is left**: no `data-armed`, no `armUntilElsewhere`, no armed flag of its own (`deskArmed`,
  `deskArmOrFire`, `deskDisarm`); armingButton arms, says so, and hands the shell its disarm.
- **Each two-press button is an armingButton handed the app's api**, saying today's armed wording; its first press
  asks nothing, its second presses as before:
  - End design mode → `End design mode: sure?`, then `press end-design` on the goal;
  - Start design mode → `Start design mode: sure?`, then `press start-design`;
  - Go all → `Go all: sure?`, then `press go-all` on the goal;
  - a row's Done not verified green (`Done ⚠`) → `Done anyway? <why>`, then `press done` on that row.
- **A goal's Close in the List presses at once**: it shows only once nothing under the goal is open
  (`deskNextPress`), so the "are you sure? N open" arming it carried could never fire, and goes with the rest.

## What its test must try to break (goal/G41.9)

- A button armed by the page itself rather than by armingButton; a first press that already presses; an armed
  wording lost; the page's own row click pressing a Done the armingButton holds.

## Requirements (goal/G41.11)

- **Armed is red, also on the design buttons.** Start design mode and End design mode carry no inline background: an
  inline colour beats the shell's armed red (`#app-content button[data-armed]`, shell.css), so armed they stayed green
  or red (found verifying goal/G41.9 on a real page). Their colour comes from a class of each that shell.css paints only
  while the button is not armed (`.<class>:not([data-armed])`).

- **Team keeps what it shows** (Andy: "in ALL the chats, new lines are no added, THE WHOLE FUCKING THING IS REDRAWN,
  killing my attempted copies"): a new line of the group chat is put in at the top (newest first), and every line already
  shown stays the same element, through that line and through any other repaint of the page (a new List row), so a
  selection survives. Team is drawn whole again only when it is read again (a reconnect).

## What its test must try to break (goal/G41.11)

- An inline `style` background left on either design button; a class whose colour shell.css paints armed or not.
- A Team line drawn again by a new line, or by a repaint of the page around it.

## goal/G41.11: every list in a box of a stated size (rule/16)

Andy: "the rules list is NOT placed properly in a size-limited container.... is this the same everywhere in desk?"
Every probabilitySearch list of the Desk page, the List (items.search) and the Rules list (rules.search), is mounted in a
box of class fill, and every box between it and the app's own box is fill too: no stat-tile, no box only as tall as its
content. A dropdown stands inline, as every dropdown in the tree does, and is not asked.

## goal/G41.12 (box v26-v35): the page reads nothing from the desk

- Andy: "The client PUTs and the server STREAMs: the client always has all available information about the server's
  state in its (persisted) cache, and reads nothing from the server"; every request is answered "ok"; "the UI for desk
  is tested fully". The page names no read verb of the desk (item.get, item.box, item.chat, item.checks, item.files,
  items.search, chat.search, rules.search, rule.get, profile.get, item.suites.search, item.checks.search,
  item.rules.search, log.search, changes); what it draws comes from spirit.data and the desk's translator.
- Not asserted yet: how the List's probabilitySearch searches spirit.data instead of items.search; the box names no
  shape for it, so the build names it and the verify drives it.
