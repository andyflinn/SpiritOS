# spirit/app/desk/element/desk/desk.js

The Desk app's page: the List of goals and items, the Rules, and the Verifier where one runs. This test covers what
goal/G41.1 (box v19-v20), goal/G41.9, goal/G41.11, goal/G43.22 and goal/G43.3 require of it.

## Requirements (goal/G41.1)

- **Icons are glyphs** (Andy: the icon set is the only source of icons on the face): every icon desk.js draws is written as the glyph itself: a goal's 📁, an item's ❌ while it asks Andy and
  💻 otherwise, the battle mark ⚔️, and a rule's status (proposed ✏️, active 🔒, deleted 💀).
- It reads no icon table (`iconIndex`, `ICON`) and has no lookup of a name into one (`deskIcon`).

## What its test must try to break

- An icon looked up by key, drawn as nothing once the table is gone.

## Requirements (goal/G41.9)

Every are-you-sure on the page is an armingButton (`spirit/element/armingButton.js`; Andy, Q1: "absolutely"), in place of
the arming desk.js hand-rolled.

- **It loads armingButton itself**, through `spirit.require('spirit/element/armingButton.js')`.
- **Nothing hand-rolled is left**: no `data-armed`, no `armUntilElsewhere`, no armed flag of its own (`deskArmed`,
  `deskArmOrFire`, `deskDisarm`); armingButton arms, says so, and hands the shell its disarm.
- **Each two-press button is an armingButton handed the app's api**, saying today's armed wording; its first press
  asks nothing, its second presses as before:
  - End design mode → `End design mode: sure?`, then `press end-design` on the goal;
  - Start design mode → `Start design mode: sure?`, then `press start-design`;
  - Go all → `Go all: sure?`, then `press go-all` on the goal;
  - a row's Done not verified green (`Done ⚠`) → `Done anyway? <why>`, then `press done` on that row.
- A goal's Close in the List pressing at once (goal/G41.9) is ended by goal/G43.30, below.

## What its test must try to break (goal/G41.9)

- A button armed by the page itself rather than by armingButton; a first press that already presses; an armed
  wording lost; the page's own row click pressing a Done the armingButton holds.

## Requirements (goal/G41.11)

- **Armed is red, also on the design buttons.** Start design mode and End design mode carry no inline background: an
  inline colour beats the shell's armed red (`#app-content button[data-armed]`, shell.css). Their colour comes from a
  class of each that shell.css paints only while the button is not armed (`.<class>:not([data-armed])`).

## Requirements (goal/G43.22)

- **No Team and no Apps** (Andy: *"G0 goes, from ui and server, kept in database."*): the page draws no Team chat,
  no Team tab and no Apps tab.

## What its test must try to break (goal/G41.11, goal/G43.22)

- An inline `style` background left on either design button; a class whose colour shell.css paints armed or not.
- A Team chat, a Team tab or an Apps tab drawn after all.

## goal/G41.11: every list in a box of a stated size (rule/16)

Andy: "the rules list is NOT placed properly in a size-limited container.... is this the same everywhere in desk?"
Every probabilitySearch list of the Desk page, the List (items.search) and the Rules list (rules.search), is mounted in a
box of class fill, and every box between it and the app's own box is fill too: no stat-tile, no box only as tall as its
content. A dropdown stands inline, as every dropdown in the tree does, and is not asked.

## Requirements (goal/G43.3)

Andy: *"on the list search item.search, these two filters: [Current Goal Only] and [Goals only] MUST be mutually exclusive, both can be off, but only one of them can be active at once. so [Current Goal only] is the only filter On by default, and it MUST show the current goal when the page opens."*

`./desk-opened.html` opens the real page in a real browser, on a stand-in desk, with nothing on the stream:

- At open, [Current Goal Only] alone is on, the first search asks for the current goal, and the current goal and its item show. No push from the stream is needed for that: a search answer asked with `currentGoalOnly` holds the current goal.
- [Goals Only] pressed turns [Current Goal Only] off, and the other way round. The search and the rows follow.
- Pressed again, both are off, and every goal's items show.

## Requirements (goal/G43.30)

Andy: *"while your mucking with desk, can you make sure that all delete and close buttons are armingButton's? box."* The box: every Delete and every Close press in Desk (its rows, the item detail, the rule dialog) is an armingButton, and *"A test presses each one once on the real page and finds that nothing happened."* Desk's run status: *"Desk and its detail load it from there"*, `spirit/app/desk/element/deskRunStatus/`.

- **Every Close in the List is an armingButton**: a goal's with nothing under it open, and a done item's in its row. The first press arms it and presses nothing, the second presses `close`.
- **On the real page**: a scratch node with desk on, a goal and its item pressed done; the Desk element on the face page; each Close the List draws pressed once leaves the item done, and each stands armed.
- **The run status** is loaded from `spirit/app/desk/element/deskRunStatus/deskRunStatus.js`, never from `shell/shared/`.

## What its test must try to break (goal/G43.30)

- A Close that closes on its first press, in the stand-in or on the real page; a check of armed buttons that passes on none drawn.
- A run status still loaded from shell/shared/.

## Requirements: an item's details open every time

Andy: "after i closed "Fix api branches" the other items won't open for me", "all i see, when opening another item is the
titlebar of that item".

1. Every item opens in the one details layer, every rule in the one rule layer. A closed layer is hidden, not destroyed
   (spirit/element/panel.js), and the details find their parts by id. So a second layer of the same kind drew into the
   first one's hidden parts and showed its title bar alone.
2. Opening another row fills that layer again with that row, under its title.

## What its test must try to break

- In a real browser on a scratch node, with desk switched on, a goal and two items: the first item opened, closed with its
  ✕, then the second opened. The second must draw its own details, and there must be one layer, not two.

## The noPlugins part: spirit/app/desk/element/desk/desk.js

goal/G43.22. Its test is the noPlugins part of `./desk.js`: the tree read as it is, comments left out.

Andy, the box: *"the apps and plugin system goes."*, *"there will only be goals, items and rules left, plus the verifier stuff can stay for now."*

### Requirements

- Andy (Q5): *"G0 goes, from ui and server, kept in database."*: the desk page names no `goal/G0` and no plugin, and draws no Apps tab and no plugin tab.
