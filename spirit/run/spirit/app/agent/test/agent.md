# spirit/app/agent/agent.js

The Agent in `spirit/app/agent/`, as Andy sees it (goal/G43.13). Its test is `./agent.js`: a real node on a scratch copy of the tracked files, and real clicks in a real Chrome on the appSelector, made as the shell app (`spirit/app/app/element.js`) makes it.

`agent.js` is a few lines: on a page it loads `browserAgent.js`, in a node `nodeAgent.js`. Their own suites are `./browserAgent.md` and `./nodeAgent.md`.

## Requirements

### Its one switch

- `active` in `spirit/state/agent/node.json` is its one switch. Before Activate no server job runs, its verbs are not answered, its row is in the pane and it has no tile.
- Activate on its row starts the server, under the job id `spirit.app.agent`, with its rows in `spirit/state/agent/data/`.
- Deactivate stops the server. Its row stays in the pane and its tile goes.
- A restarted node starts it while it is active, and the rows made before are there.

### What Andy sees

- Its tile opens the app; its ✕ puts it out of view (the panel hides, never destroys: what it drew stays, none of it shown), and it opens again.
- The provider, model, persona and job tables each show their row.
- A row the server adds reaches the page's `spirit.data.agent` with no reload: `data.js` takes the id `spirit.app.agent`.
- The server's tool on the right strip shows ⚙, and its panel shows the agent's icon, then its label, then serverDEBUG (goal/G43.15). Pressed, `agent.DEBUG {}` says true, the node keeps `debug` true in `spirit/state/agent/node.json`, no `config.json` of the agent's own is written, and the panel says turn off DEBUG.
- Nothing throws on the page.

### What goes

- The tick box `showDebug` is off the page.
- No sidecar of the agent stands anywhere, and no code or test of the agent names one.
- No code of the agent names `process/js/agent` or `shell/agent`.

## Not judged here

- What the box puts out of this item: bundles, faces and puppets, and a tag.

## The centreTabs part: spirit/app/agent/test/agent.js

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

## The listBoxes part: spirit/app/agent/agent.js, as one app: every list in a box of a stated size

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
