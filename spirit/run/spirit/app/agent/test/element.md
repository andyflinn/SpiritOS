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
  `spirit/app/agent/test/agent-centreTabs.md`).

## What its test must try to break

- A DEBUG switch that does not follow the server's job in spirit.data.jobs.data, or follows the click instead.
- A state kept in the cache before the app opened, not shown at once.
- A table handed an api, or an api made in its code.
- A file saved at all.
- A Grants tool left, or a right strip without the bundle editor.
