# spirit/app/testicle/element.js, testicle's first-cut face

testicle is the test app (goal/G45): a robot that keeps the product tree's test status. This item, goal/G45.1, builds only
its first-cut face; its server, its watch and its database come later, and no table is made or filled here. Its test is
`./element.js`: a real node on a scratch copy of the tracked files, with planted files of every kind the face must tell
apart, and the face mounted in a real Chrome on `/face.html`.

The box: *"a first-cut face of testicle: a workBench with one 📁 icon, its file viewer showing production *.js files
only"*, *"testicle's face calls no verbs in this round: it shows a file pane in the leftmost workBench pane, and nothing
else"*, *"A face-only app is its manifest and its element.js, as contact and starter are"*, *"The file viewer is the
existing file list with a filter for production *.js files: no new list."*

`spirit.element.spirit.app.testicle.element.create(container, options)` -> `{ destroy() }`.

## Requirements

**A face, and a server beside it** (goal/G47.1, the server cycle; the server's own checks are `./testicle.md`).
- `spirit/app/testicle/testicle.json` is there and is JSON: an icon and a label; intrinsic (the goal box: *"an intrinsic
  app with a server and a face"*); a face, `shell.mount` true; a server, `node.mount` true.
- Its folder holds `testicle.json`, `element.js`, `testicle.js`, `api.js`, `data.js`, and a json description of each
  verb it serves (Andy's rule 6): `busy.json`, `preferences.json`, `run.json`, `script.get.json`, `suite.search.json`, `testicle.set.json`, `testicle.search.json`, `red.json`, `subscribe.json`,
  `unsubscribe.json`; and its `test/` folder, nothing else; its `mount` names `element.js`.
- `spirit/app/test/` stays the app branch's test folder: no `test.json` there.

**No verbs, no list of its own.**
- `element.js` draws with the workBench element (`spirit/element/workBench.js`) and the existing file list
  (`spirit/element/search/file.js`), and makes no list of its own.
- It asks the node only through spirit, never by itself: no `peerPost`, no `fetch` (goal/G47.1: a click asks
  `testicle.script.get`).

**On the page.**
- It loads through `spirit.require` and stands at `spirit.element.spirit.app.testicle.element`; `create(container)`
  answers `{ destroy }`.
- A workBench whose left strip holds two icons, 📁 then ⚙ (goal/G47.1, box v79, 2: *"the second icon below the existing one"*), and whose right strip holds none.
- ⚙ opens the panel *"⚙ Configuration"* in the left pane: one switch, the toggle form the app list uses (rowFormToggle), on interactive, off auto, drawn from the preference interactive (asked of testicle.preferences once, then followed in testicle's branch, which the stream keeps); no Save: a press sends the other mode at once, and the switch moves only when the stream brings it back (goal/G47.1, box v80, 2). A refusal is said below the form.
- Ahead of the 🛌/🚶‍➡️ icon the monitor row shows the mode, 🤖 auto or 🖖 interactive, from the same branch (box v80, 2).
- Its leftmost pane shows the file list; the centre holds the testicle search's tab alone (below).
- The list shows production `*.js` files only: a `.js` outside any `test/` folder shows; a `.md`, a `.json`, and a test in
  a `test/` folder never show.
- `destroy()` leaves its container empty.
- **Flat** (goal/G47.1, the box: *"testicle turns flat on."*): it draws the file list with `flat: true`. No folder row
  shows, with the field empty or words typed; with the field empty files deep in the tree show, no folder opened, each
  row with its path.

**The file detail** (goal/G47.1, the UI cycle). The box: *"When a user clicks on a production file in the left pane of
the production file list"*, *"A new tab is opened and activated in the center pane's tabContainer: the file detail"*, *"The
tab header shows the production file name without path"*, *"The detail shows as title row the full file name, and below
it a standard testicle.suite.search"*, *"All tabs are closable"*, *"The tab opens first, with its title line; then
file.get runs, and below the title line it shows either the error file.get gives ... or the suite search for that file"*,
*"The UI must listen to changes on all tables it interacts with, and the server, of course, publishes changes"*, *"the
suite search is spirit/element/search/suite.js and its folder"*.
- A click opens one tab, active, closable, its header the file name without path; the detail's title row the full name,
  below it every suite that concerns the file, each once. The click's `script.get` made the script's rows.
- A second click on the same file opens no second tab; a click on another file opens a second, which alone is active and
  shows its own detail.
- A suite written for the file shows in its open detail with no click.
- Every element follows the stream (goal/G47.1): *"Every element of testicle's face updates itself in response to the
  server stream: what the server streams, a row or busy, shows in every element drawing it, never asked again and never
  waiting for a reload."* eta's own test removed from disc while its tab is open: its suite row, streamed deleted, leaves
  the detail or is drawn deleted, with no click; written again, it is back.
- The monitor row (goal/G47.1): *"testicle's face has a monitor row above the workbench. It shows first the busy status in
  icon form, 🛌 idle (sleeping), 🚶‍➡️ working, as the server streams it ... then the last change: a row added, deleted or
  updated in any of its three tables"*, *"The row has a constant height, and the message is ellipsed, never wrapped"*,
  *"the page never asks testicle.busy"*. The row sits above the left pane, its text starting with the icon; neither the
  face nor data.js asks testicle.busy; while iota's suite, started by its 🏃‍♂️, runs, the icon shows 🚶‍➡️, then 🛌 once
  the server listens again; a new script's file makes the message name it; a script with a long name leaves the row's
  height as it was, its message on one line, overflow hidden, ellipsed.
- The missing own test (goal/G47.1): *"A script tab shows, right under its title line, the name of the script's own test in
  red when that test is missing on disc: the folder test/ beside the script, the same file name ... When the own test is
  there, nothing shows in that place. It follows the disc: once the test file is written, the red name goes by itself."*
  alsoShown.js, with no own test, shows `spirit/zzTesticle/inner/test/alsoShown.js` in red first under its title; shown.js,
  with its own, shows nothing red there; eta.js shows its test's name in red until the test is written, then not.
- A file removed as it is clicked: its tab opens, active, and below the title line the error *"no such file"*, no search.
- A tab's close button takes it away.
- On a flip of a test (goal/G47.1, the cycle "the test table streamed, and the page showing the current tests"), the
  replaced row, current false, reaches the page beside the new current row: the server publishes both.
- The page keeps every test row by its full key, `script|suite|test|flipped`, so a flipped test keeps both its rows.
- The testicle search (goal/G47.1, the cycle "the testicle search"): at the start the centre holds one tab, the testicle
  search (`spirit/element/search/testicle.js`, judged in its own test), not closable; it stays first, before the script
  tabs, which stay closable. A click on a test row there opens a new tab, active and closable: the test's history of
  flips, every row of it, the newest first.
- Running a suite (goal/G47.1, the cycle "run a suite from the script tab"): every suite row of a script tab has a 🏃‍♂️ in
  its first column, the busy button (`spirit/element/busyButton.js`). A press on iota's own suite is answered at once: the
  button is no longer busy while the suite, which waits three seconds before its tests, still runs. The suite's tests then
  show in the permanent testicle search tab by themselves, once its green filter is on: they pass, and the search opens on
  the reds alone (*"The testicle search's default equals testicle.red"*).

## What its test must try to break

- A manifest with no server; a file in its folder beyond those named.
- A second icon on the strip, or a right strip.
- A list of its own beside the file list, or a verb the face asks itself.
- A file shown that is no production script: another type, or a test.
- Anything left in its container after destroy.
- A folder row; the tree's look, a deep file hidden or its path hidden, while the field is empty.
- A click that opens no tab, two tabs for one file, a header with the path, a detail missing a suite or listing one twice, a
  detail that does not follow a new suite, an error that waits for the tab or shows a search beside it, a tab that
  cannot be closed.
- A flip whose replaced row never reaches the page, or a test row kept under a key without its flipped, the old row
  overwritten by the new.

Vendored libraries' scripts are no production scripts either; the fs family's mirror never holds them
(`spirit/fileSystem.js`, `VENDORED_FOLDERS`), so the list cannot show them and the test does not ask.

## Box v79, 2 and 4: the ⚙ Configuration panel

- The left strip holds two icons, 📁 then ⚙ below it.
- ⚙ pressed opens a panel in the left pane titled "⚙ Configuration"; its one switch offers interactive and auto, and
  shows interactive at the start.
- auto chosen in the panel sets the node's preference `interactive` false; a set by the verb elsewhere (`interactive`
  true) is followed by the panel, as a set is published to testicle's subscribers.
- Its test must try to break: a third icon or ⚙ above 📁; a panel that shows auto by default; a choice that never reaches
  the node; a panel that does not follow a set made elsewhere.
