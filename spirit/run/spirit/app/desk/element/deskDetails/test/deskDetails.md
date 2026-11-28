# spirit/app/desk/element/deskDetails/deskDetails.js

An item's details page in the Desk app: the box and the red Qs, each a
panel behind an icon on its left strip. This test covers what goal/G41.1 (box v19-v20), G41.9, G41.11, G41.22,
G43.3 and G43.22 require of it, and the verifier's removal.

## Requirements (goal/G41.1)

- **Icons are glyphs** (Andy: the icon set is the only source of icons on the face): each panel of `DD_PANELS` names
  its icon as the glyph itself. Its panels are two, in this order: the box, the red Qs (no
  rules panel since goal/G47.4; no blocks or files panel since goal/G48.8). The strip is the workBench's (goal/G41.22), handed each glyph as it is; that is checked
  on what it is handed (below).
- It reads no icon table (`iconIndex`, `ICON`).

## What its test must try to break

- A panel icon given as a key, drawn as `undefined` once the table is gone.

## Requirements (goal/G41.9)

Every are-you-sure in the dialog is an armingButton (`spirit/element/armingButton/script.js`; Andy, Q1: "absolutely"), in place of
the arming deskDetails.js hand-rolled.

- **It loads armingButton itself**, through `spirit.requireScript('spirit/element/armingButton/script.js')`.
- **Nothing hand-rolled is left**: no `data-armed`, no `armUntilElsewhere`, no armed flag of its own (`ddArmed`,
  `ddDisarm`, `armedClose`, `armedAll`).
- **Each two-press button is an armingButton handed the app's api**, saying today's armed wording; its first press
  writes nothing, its second writes as before:
  - Go all → `Go all: sure?`, then `press go-all`;
  - Delete → `Delete: sure?`, then `item.delete`; Abandon → `Sure? Abandon the goal`, then `press abandon`;
  - an early Close → `are you sure? N open` on a goal with N items open, `Close: sure?` on an open item, then `press close`;

## What its test must try to break (goal/G41.9)

- A button armed by the dialog itself rather than by armingButton; a first press that already writes; an armed
  wording lost; a close sent on one press.

## Requirements (no verifier in desk)

The box: *"Delete ..., and get rid of ... junk in desk"*, *"desk's face loses the Verifier tab, the run status (the
... element and the List column it fills), and the verifier parts of deskDetails"*, *"agents still claim done, only the
user gets to actually press done. No verifier involvement with desk anywhere."*

- **Done is a plain press**: no warning mark, no arming; its first press sends `press done`, labelled `Done` (no claim count since goal/G48.8).
- **No Verify button and no run**: no `dd-verify`, even where the facts' buttons offer `verify`; no `dd-run`; nothing of
  a verifier loaded (no cache manager of one, no run status).
- **No suites panel**: no suites icon on the strip, and the dialog asks for no suites.

## What its test must try to break (no verifier in desk)

- A Done that arms or carries a mark; a Verify drawn from a `verify` in the facts; a run box; a suites read or icon.

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

## Requirements (goal/G41.22, box v15)

Andy: *"the item panel drops appHeader"*, *"the items ID and title, including status is shown in the shells title bar
like always"*, *"one row, the button row, at the top, using the whole width, like it is today"*, *"just use workBench"*,
*"the left icons strip and panel, are what we have today"*, *"the center panel us the chat"*, *"the right panel, we
leave blank"*, *"newest lines at the bottom, pinned to the bottom, and older lines above"*, *"the chat input can only be sized
vertically"*.

- **No appHeader**: deskDetails.js names none. The id, title and status go to the shell's title bar
  (`api.setScreenTitle`).
- **One workBench** (`spirit/element/workBench/script.js`, loaded through `spirit.requireScript`), made inside the dialog's body.
  - Its **left** tools are today's panels, `DD_PANELS`, each by its key and glyph, in order. A left icon shows that
    panel in the left pane.
  - Its **right** side has no tool: it is blank.
  - Its **centre** is the chat: the lines (`dd-chat`), the input (`dd-say`) at the bottom. No chat search (goal/G43.22;
    Andy: *"take out the chat-search do, it's not actually usable."*).
- **The button row** (`dd-name-row`) stands above the workBench, outside it, the whole width.
- **The input** resizes up and down only (`resize: vertical`).
- **Newest at the bottom**: the lines read oldest to newest, top to bottom. A new line from the stream goes in at the
  bottom. The chat opens pinned to the bottom and stays there after a new line: a box of the chat is scrolled to its
  end, or the lines are shown reversed (`flex-direction: column-reverse`).
- That every box of the panel is bounded, tall and wide, is the shell's general rules' check
  (`spirit/testicle/general/browser/pageRules/script.js`), which mounts this app.

### Opened on an item, in a real browser (goal/G41.22)

The page above has no layout, so what fills and what scrolls is asked of Chrome: `./deskDetails-opened.html`, opened at
`/DEBUG/spirit/app/desk/element/deskDetails/test/deskDetails-opened.html` on a scratch node with its DEBUG on (`spirit/testicle/headLessChrome/script.js`),
opens the panel in the home page's app area (`#app-container` > `#app-header`, `#app-content`, under `/shell.css`) on
an item with 200 chat lines and a long box. The desk is a stand-in that answers the reads.

- The page does not scroll, nor the app area; the chat input's bottom is on screen.
- The chat is scrolled to its end, and the newest line is its last, shown whole above the chat's bottom.
- At open a left panel shows.
- **Every left panel uses all the height** (Andy: *"the box must use the full vertical space"*, *"all left side panels
  must fucking use all available vertical space, especially the lists"*): the box and the red Qs (60), each shown in turn, the first time its icon is pressed (Andy:
  *"i want to see the panel content THE FIRST  TIME i pop in a panel, NOT the second time."*). The pane itself never
  scrolls; the panel's own list, or the box's text, scrolls in itself, its bottom at the pane's bottom.

## What its test must try to break (goal/G41.22)

- An appHeader left; the title bar missing the id, the title or the status.
- No workBench, or two; a panel missing from the left strip, or out of order; a tool on the right.
- The button row inside the workBench, or below it.
- The chat or its input outside the centre, or out of order; a chat search drawn after all; an input that resizes sideways.
- The newest line on top; a new line put in on top; a chat not scrolled to its newest line; a line drawn again.
- In the browser: a chat stopped short of its end, the newest line cut off; a left pane empty at open; a box a third of
  its pane; a list as tall as nothing, cut off unseen, or the pane scrolling instead of the list.

## goal/G43.3: the box panel, who asked

- *"i want the UI to allow me to search the box currently displayed: the exact content of the box on my screen, also a codeMirror box on-screen would help because it show line-numbers?"* In a real browser: the box is a CodeMirror showing line numbers. There is no search field beside it (goal/G43.22; Andy: *"take out your search of the items text, the codeMirror search works better for editing purposes."*). No server is asked. Leaving it changed writes his text on the version it read, as the textarea did.
- *"above the box i want to see the the last-stored version number of the box."* The version the desk answered stands above the box.
- *"red Q's should indicate who posted them."* The Qs panel shows the question and who placed it.

## Requirements (goal/G43.30)

Andy: *"while your mucking with desk, can you make sure that all delete and close buttons are armingButton's? box."* The box: every Delete and every Close press in Desk (its rows, the item detail, the rule dialog) is an armingButton, and *"A test presses each one once on the real page and finds that nothing happened."*

- **Every Close is an armingButton**: a done item's (desk/G3.8 pressed it at once) and a goal's with nothing open (goal/G6.6 pressed it at once), as the early Close and a goal's with items open already were. The first press arms it and writes nothing, the second presses `close`.
- **On the real page**: a scratch node with desk on, a goal, an item pressed done and an item in design mode; each detail opened from Desk's List. The done item's Close pressed once leaves it done and stands armed; the design item's Delete pressed once leaves it there, its status as before and still offering Delete, and stands armed.

## What its test must try to break (goal/G43.30)

- A Close or a Delete that writes on its first press, in the stand-in or on the real page.
- "Nothing deleted" judged on an item that is gone, or on a status that reads empty for both.

## The noFind part: spirit/app/desk/element/deskDetails/deskDetails.js

goal/G43.22. Its test is the noFind part of `./deskDetails.js`: the tree read as it is, comments left out.

Andy, the box: *"the apps and plugin system goes."*, *"there will only be goals, items and rules left, plus the verifier stuff can stay for now."*

### Requirements

- Andy: *"take out your search of the items text"*, *"take out the chat-search do, it's not actually usable."*: the item detail has no find field over its box and no chat search.

## The noSharedLeftovers part: dropped

The plugin leftovers once in `shell/shared` (goal/G43.23, item 10): `shell/` is gone with all it held, and a require of a file that is not there is `spirit/testicle/general/any/generalRules/script.js`'s. Their checks are dropped (goal/G47.1).

## Rules go out of Desk (goal/G47.4, box v36)

Andy: *"Next we kill rules from desk. nobody observes them"*, *"are we ready to strip rules out of desk now?"*, *"go!"*.

- The details panel has no rules icon, so no rule list can be opened; the add-rule dropdown and rule-row checks go.

## The plunger (goal/G49)

Andy: *"put the plunger back with one rowForm: ➕ \"Add blocking item\" [title-input] [Add-button], which will add an item
with <Title> blocking the goal/item it was created from."*, *"Go!"*. On the page opened on goal/G9.1:

- the detail holds one rowForm with ➕, the words "Add blocking item", a title input and a button saying Add;
- its Add, with a title typed, sends `desk.item.add {goal: goal/G9, title, blocks: goal/G9.1}`.

A goal's Close counts its open items from the rows the page holds (goal/G48.8); the case hands it one open and one done.
