# shell/deskDetails/deskDetails.js

An item's details page in the Desk app: the box, the suites, the red Qs, the blocks, the files and the rules, each a
panel behind an icon on its left strip. This test covers what goal/G41.1 (box v19-v20), G41.9, G41.11 and G41.22 require
of it.

## Requirements (goal/G41.1)

- **Icons are glyphs** (Andy: the icon set is the only source of icons on the face; `spirit/client/iconIndex.js`
  deleted): each panel of `DD_PANELS` names its icon as the glyph itself, and the strip draws it as it is. Since
  goal/G41.22 the strip is the workBench's, handed each glyph as it is; that is checked on what it is handed (below).
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
- **The chat keeps what it shows** (Andy: "in ALL the chats, new lines are no added, THE WHOLE FUCKING THING IS
  REDRAWN, killing my attempted copies"): every line already shown stays the same element, through a new line and
  through any other repaint (a check, a status), so a selection survives. The whole chat is drawn again only when the
  panel reloads (a dropped update, another subject). Where a new line goes is goal/G41.22's, below.

## What its test must try to break (goal/G41.11)

- A red Q cleared, or design started or ended, on one press; the remove or a design button not made by armingButton.
- A rename field that opens empty, on an item or a goal.
- A chat line drawn again by a new line or by a repaint that is no chat line.

## goal/G41.11: the rules panel scrolls inside its own box

The upper half is fixed at 30vh with its overflow hidden; the box that bounds the rules panel scrolls (overflow auto), so
a long list of rules is never cut off unseen. Its dropdowns stand inline, as every dropdown in the tree does.

## Requirements (goal/G41.22, box v15)

Andy: *"the item panel drops appHeader"*, *"the items ID and title, including status is shown in the shells title bar
like always"*, *"one row, the button row, at the top, using the whole width, like it is today"*, *"just use workBench"*,
*"the left icons strip and panel, are what we have today"*, *"the center panel us the chat"*, *"the right panel, we
leave blank, but will carry plugin-desk-apps"*, *"the chat has it's search at the top and it's input at the bottom"*,
*"newest lines at the bottom, pinned to the bottom, and older lines above"*, *"the chat input can only be sized
vertically"*.

- **No appHeader**: deskDetails.js names none. The id, title and status go to the shell's title bar
  (`api.setScreenTitle`).
- **One workBench** (`shell/js/workBench.js`, loaded through `spirit.require`), made inside the dialog's body.
  - Its **left** tools are today's panels, `DD_PANELS`, each by its key and glyph, in order. A left icon shows that
    panel in the left pane.
  - Its **right** side has no tool: it is blank until a desk plugin app gives it one.
  - Its **centre** is the chat: the chat search (`dd-chat-find`) on top, the lines (`dd-chat`), the input (`dd-say`) at
    the bottom.
- **The button row** (`dd-name-row`) stands above the workBench, outside it, the whole width.
- **The input** resizes up and down only (`resize: vertical`).
- **Newest at the bottom**: the lines read oldest to newest, top to bottom. A new line from the stream goes in at the
  bottom. The chat opens pinned to the bottom and stays there after a new line: a box of the chat is scrolled to its
  end, or the lines are shown reversed (`flex-direction: column-reverse`).
- That every box of the panel is bounded, tall and wide, is the shell's general rules' check
  (`shell/test/boot-sibling-generalRules.md`), which mounts this app.

### Opened on an item, in a real browser (goal/G41.22)

The page above has no layout, so what fills and what scrolls is asked of Chrome: `./deskDetails-opened.html`, opened at
`/DEBUG/shell/deskDetails/test/deskDetails-opened.html` on a scratch node with its DEBUG on (`test/headLessChrome.js`),
opens the panel in the home page's app area (`#app-container` > `#app-header`, `#app-content`, under `/shell.css`) on
an item with 200 chat lines and a long box. The desk is a stand-in that answers the reads.

- The page does not scroll, nor the app area; the chat input's bottom is on screen.
- The chat is scrolled to its end, and the newest line is its last, shown whole above the chat's bottom.
- At open a left panel shows, as the details did before the workBench.
- The box fills the left pane, top to bottom: no box left at the old upper half's 30%.

## What its test must try to break (goal/G41.22)

- An appHeader left; the title bar missing the id, the title or the status.
- No workBench, or two; a panel missing from the left strip, or out of order; a tool on the right.
- The button row inside the workBench, or below it.
- The chat, its search or its input outside the centre, or out of order; an input that resizes sideways.
- The newest line on top; a new line put in on top; a chat not scrolled to its newest line; a line drawn again.
- In the browser: a chat stopped short of its end, the newest line cut off; a left pane empty at open; a box a third of
  its pane.
