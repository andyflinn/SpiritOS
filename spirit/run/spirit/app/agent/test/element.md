# spirit/app/agent/element.js

The agent face app (goal/G41.1): the face of the agent server, built on the `workBench` element. It runs on the face
on loopback and through a relay alike.

No agents talk to each other through it: each agent sees itself as the only agent and user of the node (goal/G3.1,
2026-10-02, and G41.1's Q1).

## Its files

- `spirit/app/agent/element.js`, the app on a page, loaded by `agent.js` (`./agent.md`).
- `spirit/app/agent/agent.json`, its manifest, in the new shape.

## Requirements

- It is an element (goal/G43.13): `spirit.element.spirit.app.agent.element.create(container)` answers `{ destroy() }`. It names no `activateApp`.
- It reads only its container (the `{ title, open }` the appSelector's launch hands it go unread), and hands its tables no api (goal/G43.24; Andy: *"every element that accesses ANY api must require them themselves"*): each table is made with its box and the detail pane, `create(box, detail)`, and its list asks `agent.<table>` through the spirit object itself. No new verb; its code makes no api.
- It keeps no state of its own: no `showDebug`, no `relay-state`, no title of the old shell, and opening it saves no file.
- Its whole app area is one workBench: it hands `workBench.create` a box that takes the shell's `fill` class (rule/16).
- It bootstraps its own components (Andy: "the shell should not know that. every app needs to bootstrap its own
  components."): with no workBench on the page, it loads `spirit/element/workBench.js` through `spirit.require`, then builds.
- The workBench has two tools on its right strip (the server's and the bundle editor, below), and on its left one per table of `agent.db`,
  in the order provider, model, persona, job, each with an icon of its own (goal/G41.4, box v22: "every one of
  these tables will come with a left-edge icon that puts up a panel in the left-side tool-display of the workBench UI
  used in this app").
- A table's tool mounts that table's own element: it requires `spirit/app/agent/table/<name>/elementTable.js` into a
  box of the shell's `fill` class.
- The server's tool on the right strip takes ⚙, not 🐞, and its panel shows serverDEBUG for the agent (goal/G43.15; Andy:
  *"agent will in the server-config, on the right icon strip the ⚙ icon instead of 🐞"*): its mount loads
  `spirit/element/search/app/serverDEBUG.js` and makes it in its box. It draws no checkbox and calls no debug verb of the agent's.
  Above serverDEBUG it shows the agent's icon and label, through changeAppIcon and changeAppLabel (goal/G43.15).

## Requirements (goal/G41.21, box v17)

- **The right strip gets its first real tool: the bundle editor.** Two right tools: the agent server's DEBUG box
  (`server`) and the bundle editor, whose mount requires `spirit/element/bundleEditor.js` and makes it in the box it is
  handed.
- **The Grants tool goes**: the left strip holds one tool per table, provider, model, persona and job; the
  app names no grants panel and no grant table.

### 💬 Select Persona, and the chat it opens (goal/G41.26)

Andy, box: *"the left site icon strip gains a [chat] icon, that opens the following, NEW panel, titled: \"💬 Select
Persona\""*, *"this new panel, below the title contains, for now, only a personaSelector:pane."*, *"When the user clicks
on a persona in the left hand \"💬 Select Persona\" pane, the chat pane shows up in the center pane of workBench"*.

- The left strip holds one more tool beside the tables': icon 💬, title `Select Persona`.
- Mounted, it loads the agent tables' element itself and draws its title row, 💬 Select Persona, then, in a box of its
  own, only a personaSelector:pane: the persona table's search in pane mode (`agentDetail.search`, rule/29), handed
  no api, and no Add.
- A persona picked there loads `spirit/app/agent/element/chatPane.js` and opens the chat pane (`./chatPane.md`) in a closable tab of the
  workBench's centre, for that persona; another persona picked opens its own tab beside it (goal/G41.31:
  `spirit/app/agent/test/agent.md`, its centreTabs part).

## What its test must try to break

- A DEBUG switch that does not follow the server's job in spirit.data.job.data, or follows the click instead.
- A state kept in the cache before the app opened, not shown at once.
- A table handed an api, or an api made in its code.
- A file saved at all.
- A Grants tool left, or a right strip without the bundle editor.

## The centreTabs part (once in ./agent.js)

goal/G41.31. The agent app's centre is a tabContainer, judged by real clicks in a real Chrome on a scratch node, at `/face.html`.

### Requirements

- **A tabContainer stands in the centre**, from the start, with no tabs.
- **Each panel is a closable tab, activated if it exists, created if not.** Headers: provider, model, persona and job `<icon> <label>`; chat `<chat-icon> <persona-label>`, a tab of its own beside its persona's; a node's bundle `<bundle-name>`; a bundle not node-owned `(<bundle-name>)` in italic print.
- **The tabs stay when the left tool changes** (Q1).
- **A label changed anywhere: its header follows.** A tab closes when it hears its row deleted. Its close button takes it away, and the row stays.
- **A tab has one listener on its row**: a press on a row that has its tab adds none, and closing the tab lets go of it. Not in Andy's words: found at verify, a listener stacked per press; a fault of the build, not a new requirement.
- **An unsaved add-tab says `new <row-type>*`.** Saved, it reads as its row, and pressing that row in the list activates it: no second tab.
- Grants keeps `<owner>-<bundle>`: `spirit/app/grants/test/element.js`.

### What its test must try to break

- A second tab for a row, or for a saved Add. A persona's tab and its chat's taken for one. A header that keeps an old label.

## The listBoxes part (once in ./agent.js): the app as one: every list in a box of a stated size

The agent app's lists, walked from each list to the app (goal/G41.18; rule/16). Its test is the listBoxes part of `./agent.js`. The app
runs on a small page (the one Desk's suite drives, copied) with the real workBench and table elements. The
search element is a recorder that keeps the box each list was made in. The selectors and the agent server are
stand-ins, the selectors in the shell's element shape, `<name>.create(container, options)` (goal/G41.19), the server tool's app icon, label and DEBUG switch among them.

Andy, on G41.18:

- *"the lists violate: rule/16 — A list gets a box of a stated size. Files and contacts do it right, agents must as
  well."*
- *"ALL lists, otherwise my took bars at the top of a container keep scrolling away...."*
- *"when a probabilitySearch is in pane-mode it must display 1) filters 2) search input row 3) a pane that uses the rest
  of the vertical space, all box elements really have to follow to follow that rule"*
- *"the agent app must also constrain all it's probability-panes"*

rule/16: every probabilitySearch is mounted in a box of class `fill`, inside a pane that fills its app. The search
element's own pane already holds the filters and the search row at their height and gives the list the rest
(`spirit/element/search.js`). What it needs is that its box, and every box above it, states its size. This suite
asks that of the app as a whole, the way Desk's does (`spirit/app/desk/element/desk/test/desk.md`, goal/G41.11).

### Requirements

- The app mounts into a `fill` box of the whole app area.
- Shown by its strip button, the list pane of each tool stands in a `fill` box, and so does every box from it up to the
  app:
  - provider, model, persona and job: the table's list (`spirit/app/agent/element/table/tableElement.js`).
- Every list pane the app drew, four at least, meets the same rule. A list drawn as a dropdown stands inline, as every
  picker in the tree does, and is not asked.

### Requirements (goal/G41.21, box v17)

- The grant tool went with agent.grant: the list panes judged are the four tables', provider, model, persona and job.

### Requirements (goal/G41.26)

Andy: *"i the left side models panel: the title row \"🧠Models\" must come before the \"from [🛖 Unsloth Studio ▾]
[Ask] row."*

- The 🧠 Models pane draws one title row saying Models, then the Ask row, then the model list. The Ask row is found by
  its providerSelector:dropdown, since goal/G41.27 makes it a rowForm, `[❓] [Pick a provider ▾] [Ask]`, with no word
  from; the app runs the real rowForm and icon element for it.

### Requirements (goal/G41.28)

Andy, the box: *"anything not using the new spiritData.js and it's buddies clientCacheManager.js must do so in this
item. no exceptions."*

- Every list pane the app drew is a view of its table in the agent family's cache: it is handed that table's branch,
  `spirit.data.agent.data.branch(table)`. The page runs the real data set, its node known, and the families' own managers
  (`spirit.cacheManager(name)`).

### What its test must try to break

- Any box between a list and the app that is only as tall as its content. Mutated:
  - the workBench's side pane without `fill`;
  - the table list's own box without `fill`.
- A Models pane whose Ask row stands above its title row, or that draws its title twice.
- A list pane handed no branch, or another table's.
