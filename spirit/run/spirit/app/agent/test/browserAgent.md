# spirit/app/agent/browserAgent.js

The agent face app (goal/G41.1): the face of the agent server, built on the `workBench` element. It runs on the face
on loopback and through a relay alike.

No agents talk to each other through it: each agent sees itself as the only agent and user of the node (goal/G3.1,
2026-10-02, and G41.1's Q1).

## Its files

- `spirit/app/agent/browserAgent.js`, the app on a page, loaded by `agent.js` (`./agent.md`).
- `spirit/app/agent/agent.json`, its manifest, in the new shape.

## Requirements

- It is an element, as `monitor.js` is (goal/G43.13): `spirit.elements.agent.create(container)` answers `{ destroy() }`. It names no `activateApp`.
- A tile hands it only its container, so it passes its tables one small object of its own, `{ verb }`, calling the same server verbs and answering `{ status, body }`. No new verb.
- It keeps no state of its own: no `showDebug`, no `relay-state`, no title of the old shell, and opening it saves no file.
- Its whole app area is one workBench: it hands `workBench.create` a box that takes the shell's `fill` class (rule/16).
- It bootstraps its own components (Andy: "the shell should not know that. every app needs to bootstrap its own
  components."): with no workBench on the page, it loads `spirit/element/workBench.js` through `spirit.require`, then builds.
- The workBench has one tool on its right strip, and on its left one per table of `agent.db`,
  in the order provider, model, persona, job, each with an icon of its own (goal/G41.4, box v22: "every one of
  these tables will come with a left-edge icon that puts up a panel in the left-side tool-display of the workBench UI
  used in this app").
- A table's tool mounts that table's own element: it requires `spirit/app/agent/table/<name>/elementTable.js` into a
  box of the shell's `fill` class.
- The server's tool on the right strip takes ⚙, not 🐞, and its panel shows serverDEBUG for the agent (goal/G43.15; Andy:
  *"agent will in the server-config, on the right icon strip the ⚙ icon instead of 🐞"*): its mount loads
  `spirit/app/appSelector/serverDEBUG.js` and makes it in its box. It draws no checkbox and calls no debug verb of the agent's.

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
  own, only a personaSelector:pane: the persona table's search in pane mode (`agentDetail.search`, rule/29), with its
  `{ verb }`, and no Add.
- A persona picked there loads `spirit/app/agent/chatPane.js` and opens the chat pane (`./chatPane.md`) in a closable tab of the
  workBench's centre, for that persona; another persona picked opens its own tab beside it (goal/G41.31:
  `spirit/app/agent/test/agentCentreTabs.md`).

## What its test must try to break

- A checkbox that does not follow the server's job in spirit.data.jobs.data, or follows the click instead.
- A state kept in the cache before the app opened, not shown at once.
- A table handed no `{ verb }`, or one that does not reach the server.
- A file saved at all.
- A Grants tool left, or a right strip without the bundle editor.
