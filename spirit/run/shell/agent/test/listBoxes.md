# shell/agent/agent.js, as one app: every list in a box of a stated size

The agent app's lists, walked from each list to the app (goal/G41.18; rule/16). Its test is `./listBoxes.js`. The app
runs on a small page (the one Desk's suite drives, copied) with the real workBench, table elements and grants panel. The
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
(`shell/js/probabilitySearch.js`). What it needs is that its box, and every box above it, states its size. This suite
asks that of the app as a whole, the way Desk's does (`shell/desk/test/desk.md`, goal/G41.11).

## Requirements

- The app mounts into a `fill` box of the whole app area.
- Shown by its strip button, the list pane of each tool stands in a `fill` box, and so does every box from it up to the
  app:
  - provider, model, persona and job: the table's list (`process/js/agent/table/tableElement.js`);
  - grant: the grants panel's grant list (`shell/js/grantsPanel.js`, `shell/js/grantSelector/listElement.js`).
- Every list pane the app drew, five at least, meets the same rule. A list drawn as a dropdown stands inline, as every
  picker in the tree does, and is not asked.

## Requirements (goal/G41.21, box v17)

- The grant tool went with agent.grant: the list panes judged are the four tables', provider, model, persona and job.

## What its test must try to break

- Any box between a list and the app that is only as tall as its content. Mutated:
  - the workBench's side pane without `fill`;
  - the table list's own box without `fill`;
  - the grants list's box without `fill`.
