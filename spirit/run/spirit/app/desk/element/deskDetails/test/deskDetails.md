# spirit/app/desk/element/deskDetails/deskDetails.js

An item's details page in the Desk app: the box, the suites, the red Qs, the blocks, the files and the rules, each a
panel behind an icon on its left strip. This test covers what goal/G41.1 (box v19-v20), G41.9, G41.11, G41.22, G41.28,
G43.3 and G43.22 require of it.

## Requirements (goal/G41.1)

- **Icons are glyphs** (Andy: the icon set is the only source of icons on the face): each panel of `DD_PANELS` names
  its icon as the glyph itself. The strip is the workBench's (goal/G41.22), handed each glyph as it is; that is checked
  on what it is handed (below).
- It reads no icon table (`iconIndex`, `ICON`).

## What its test must try to break

- A panel icon given as a key, drawn as `undefined` once the table is gone.

## Requirements (goal/G41.9)

Every are-you-sure in the dialog is an armingButton (`spirit/element/armingButton.js`; Andy, Q1: "absolutely"), in place of
the arming deskDetails.js hand-rolled.

- **It loads armingButton itself**, through `spirit.require('spirit/element/armingButton.js')`.
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

The left pane hides its overflow; the first box that bounds the rules panel scrolls (overflow auto), so a long list of
rules is never cut off unseen. Its dropdowns stand inline, as every dropdown in the tree does.

## Requirements (goal/G41.22, box v15)

Andy: *"the item panel drops appHeader"*, *"the items ID and title, including status is shown in the shells title bar
like always"*, *"one row, the button row, at the top, using the whole width, like it is today"*, *"just use workBench"*,
*"the left icons strip and panel, are what we have today"*, *"the center panel us the chat"*, *"the right panel, we
leave blank"*, *"newest lines at the bottom, pinned to the bottom, and older lines above"*, *"the chat input can only be sized
vertically"*.

- **No appHeader**: deskDetails.js names none. The id, title and status go to the shell's title bar
  (`api.setScreenTitle`).
- **One workBench** (`spirit/element/workBench.js`, loaded through `spirit.require`), made inside the dialog's body.
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
  (`test/spirit-sibling-generalRules.md`), which mounts this app.

### Opened on an item, in a real browser (goal/G41.22)

The page above has no layout, so what fills and what scrolls is asked of Chrome: `./deskDetails-opened.html`, opened at
`/DEBUG/spirit/app/desk/element/deskDetails/test/deskDetails-opened.html` on a scratch node with its DEBUG on (`test/headLessChrome.js`),
opens the panel in the home page's app area (`#app-container` > `#app-header`, `#app-content`, under `/shell.css`) on
an item with 200 chat lines and a long box. The desk is a stand-in that answers the reads.

- The page does not scroll, nor the app area; the chat input's bottom is on screen.
- The chat is scrolled to its end, and the newest line is its last, shown whole above the chat's bottom.
- At open a left panel shows.
- **Every left panel uses all the height** (Andy: *"the box must use the full vertical space"*, *"all left side panels
  must fucking use all available vertical space, especially the lists"*): the box, the red Qs (60), the files (150, with
  three open grants), the rules (60) and the suites (60), each shown in turn, the first time its icon is pressed (Andy:
  *"i want to see the panel content THE FIRST  TIME i pop in a panel, NOT the second time."*). The pane itself never
  scrolls; the panel's own list, or the box's text, scrolls in itself, its bottom at the pane's bottom. The blocks are a
  few links, not a list, and are not asked.
- **The files panel's grant row is pinned on top** (Andy: *"the file panel must have the red gran button row pinned to
  the top and the file list only using the remaining vertical space"*): the grant buttons are not in the list that
  scrolls, stand above it, and stay where they are when the list is scrolled to its end.

## What its test must try to break (goal/G41.22)

- An appHeader left; the title bar missing the id, the title or the status.
- No workBench, or two; a panel missing from the left strip, or out of order; a tool on the right.
- The button row inside the workBench, or below it.
- The chat or its input outside the centre, or out of order; a chat search drawn after all; an input that resizes sideways.
- The newest line on top; a new line put in on top; a chat not scrolled to its newest line; a line drawn again.
- In the browser: a chat stopped short of its end, the newest line cut off; a left pane empty at open; a box a third of
  its pane; a list as tall as nothing, cut off unseen, or the pane scrolling instead of the list; grant buttons that
  scroll away with the files.

## Requirements (goal/G41.22, box v22: push Goal)

Andy: *"the current goal and all its items, get a new button in the detail panel: "push Goal", the ver on the desk is:
"pushgoal""*.

- The current goal's details, and the details of each item of the current goal, show a button reading `push Goal` in
  the button row (`#dd-name-row`).
- Pressing it sends the desk's verb pushgoal, `desk.pushgoal` (as `ddAsk` names every verb: `'desk.' + verb`), once.
  Pressed once, and once more only if the first press armed it: whether it asks are-you-sure is the build's choice.
- A goal that is not current, and an item of one, show no push Goal.

What the test assumes: the dialog decides nothing (its header), so the desk says where push Goal stands: `pushgoal` in
the item's `buttons`, on the current goal and on each of its items, as `make-current` is offered on a goal that is not
current (spirit/run/spirit/app/desk/desk.js, buttons). The facts carry no current-goal field today, and the test adds none. The
verb's arguments are the build's; the test asserts only the verb sent.

## What its test must try to break (goal/G41.22, box v22: push Goal)

- No push Goal on the current goal, or on an item of it; a button reading something else, or outside the button row.
- A press that sends nothing, sends a press (`desk.press`) instead of the verb, or sends the verb twice.
- A push Goal drawn where the desk offers no pushgoal.

## Requirements (goal/G41.28: the verifier's run, through spirit.data)

Andy: *"EVERY FUCKING ELEMENT is verified to make sure when it changes shit it listens to fucking update via the spirit
object"*. The run of this item (goal/G33.6) is the verifier's own publish, kept by its family's cache manager.

- **It loads the verifier's cache manager itself**, `spirit/app/deskVerify/data.js`, through
  `spirit.require`, and draws the run from `spirit.data.deskVerify.data`, through the shared run status
  (`shell/shared/js/deskRunStatus.js`), on the page's real data set.
- With an item open whose facts say `verifyRunning`, a verifier publish taken into spirit.data (a job of module
  `spirit.app.deskVerify`, its app `{ doing: 'run', suite, index, of, ... }`) redraws `#dd-run`: its progress, its suite
  and how far (`verifying <suite>, suite <index> of <of>`); the next publish redraws it again.
- A run already kept in spirit.data when the dialog opens is drawn at once.
- A publish of another node's verifier draws nothing here; nor does a publish that says no `doing`.

## What its test must try to break (goal/G41.28)

- A run the dialog reads by itself, or not at all; a watch that hears nothing; a kept run not drawn at open.
- Another node's verifier drawn as this node's; a publish with no `doing` drawn as a run.

## goal/G43.3: the box panel, who asked, the rules panel

- *"i want the UI to allow me to search the box currently displayed: the exact content of the box on my screen, also a codeMirror box on-screen would help because it show line-numbers?"* In a real browser: the box is a CodeMirror showing line numbers. There is no search field beside it (goal/G43.22; Andy: *"take out your search of the items text, the codeMirror search works better for editing purposes."*). No server is asked. Going into the box takes it, and leaving it changed writes his text on the version it read, as the textarea did.
- *"above the box i want to see the the last-stored version number of the box."* The version the desk answered stands above the box.
- *"red Q's should indicate who posted them."* The Qs panel shows the question and who placed it.
- *"when i add a rule to an item or goal, it will not immediately display in the rule-list."* With the rules panel open on an item or a goal, a row naming a new rule shows it at once, with no read asked.
- *"when i manually add rules to an item, the rule-picker should default to all filters off. Now i always have to turn of all but one search filter to actually find the rule I'm looking for."* In a real browser: the picker opens with no type filter on, and one type pressed is the only one on, the search asking for that type.
