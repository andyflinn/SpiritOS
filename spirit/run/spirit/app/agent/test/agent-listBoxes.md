# spirit/app/agent/agent.js, as one app: every list in a box of a stated size

The agent app's lists, walked from each list to the app (goal/G41.18; rule/16). Its test is `./agent-listBoxes.js`. The app
runs on a small page (the one Desk's suite drives, copied) with the real workBench and table elements. The
search element is a recorder that keeps the box each list was made in. The selectors and the agent server are
stand-ins, the selectors in the shell's element shape, `<name>.create(container, options)` (goal/G41.19).

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

## Requirements

- The app mounts into a `fill` box of the whole app area.
- Shown by its strip button, the list pane of each tool stands in a `fill` box, and so does every box from it up to the
  app:
  - provider, model, persona and job: the table's list (`spirit/app/agent/element/table/tableElement.js`).
- Every list pane the app drew, four at least, meets the same rule. A list drawn as a dropdown stands inline, as every
  picker in the tree does, and is not asked.

## Requirements (goal/G41.21, box v17)

- The grant tool went with agent.grant: the list panes judged are the four tables', provider, model, persona and job.

## Requirements (goal/G41.26)

Andy: *"i the left side models panel: the title row \"🧠Models\" must come before the \"from [🛖 Unsloth Studio ▾]
[Ask] row."*

- The 🧠 Models pane draws one title row saying Models, then the Ask row, then the model list. The Ask row is found by
  its providerSelector:dropdown, since goal/G41.27 makes it a rowForm, `[❓] [Pick a provider ▾] [Ask]`, with no word
  from; the app runs the real rowForm and icon element for it.

## Requirements (goal/G41.28)

Andy, the box: *"anything not using the new spiritData.js and it's buddies clientCacheManager.js must do so in this
item. no exceptions."*

- Every list pane the app drew is a view of its table in the agent family's cache: it is handed that table's branch,
  `spirit.data.agent.data.branch(table)`. The page runs the real data set, its node known, and the families' own managers
  (`spirit.cacheManager(name)`).

## What its test must try to break

- Any box between a list and the app that is only as tall as its content. Mutated:
  - the workBench's side pane without `fill`;
  - the table list's own box without `fill`.
- A Models pane whose Ask row stands above its title row, or that draws its title twice.
- A list pane handed no branch, or another table's.
