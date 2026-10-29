# shell/agent/agent.js

The agent face app (goal/G41.1): the face of the agent server, built on the `workBench` element. It runs on the face
on loopback and through a relay alike.

No agents talk to each other through it: each agent sees itself as the only agent and user of the node (goal/G3.1,
2026-10-02, and G41.1's Q1).

## Its files

- `shell/agent/agent.js`, the app.
- `shell/agent/agent.json`, its manifest, naming its server, `agent`.
- No sidecar beside its code: whether a node shows it on the face is that node's own state
  (`relay-state/shell/agent/agent.js.sidecar.json`, goal/G41.1, box v16-v17).

## Its state

- `relay-state/shell/agent/config.json`, its own, out of git: `{ "showDebug": <true or false> }`, whether the window's
  title bar shows the agent server's DEBUG state.

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api) })`.
- Its whole app area is one workBench: it hands `workBench.create` a box that takes the shell's `fill` class (rule/16).
- It bootstraps its own components (Andy: "the shell should not know that. every app needs to bootstrap its own
  components."): with no workBench on the page, it loads `shell/js/workBench.js` through `spirit.require`, then builds.
- The workBench has one tool on its right strip, and on its left the app's own tool, then one per table of `agent.db`,
  in the order provider, model, persona, job, grant, each with an icon of its own (goal/G41.4, box v22: "every one of
  these tables will come with a left-edge icon that puts up a panel in the left-side tool-display of the workBench UI
  used in this app").
- A table's tool mounts that table's own element: it requires `process/js/agent/table/<name>/elementTable.js` into a
  box of the shell's `fill` class.
- The left tool keeps `relay-state/shell/agent/config.json`:
  - At mount it reads the file through `spirit.fs.loadFile`; with none, `showDebug` is false.
  - It draws one checkbox, checked when `showDebug` is true.
  - Changing the checkbox saves the file through `spirit.fs.saveFile`, with the new `showDebug`.
- The right tool sets the agent server's DEBUG state (Andy, Q5: "the app is supposed to require it's components, then use
  them."):
  - It draws one checkbox. Changing it requires the agent server's interface through spirit
    (`spirit.require('process/js/agent/agent.family/api.js')`), then calls its `debug({ on })` with the checkbox's
    state. Nothing goes out any other way: no `api.verb`.
  - The checkbox shows only what the server's stream says (rule/19), never the click itself: after the call it shows the
    state last streamed.
  - It follows the server's state on the stream (`api.onJobs`): a job whose app is `{ agent: { debug } }`, read from
    the whole set of jobs as well as from the one that changed, so the state is there from the moment the app opens.
- The title bar (`api.setScreenTitle`) shows the bug icon 🐞 while `showDebug` is true and the server's DEBUG state is on,
  and does not show it otherwise. It follows both as they change.

- **The grant tool mounts the grants panel** (goal/G41.16; Andy: *"could we then show the grants element in the left
  pane, connected to the grants-by-job table?"*): it requires `shell/js/grantsPanel.js` into a fill box, and the agent's
  own grant table element no more, and creates the panel once with the app's api, configured by this app:
  - `ids`: the agent's jobs, `loopback://api/agent/job`, with their key and label fields;
  - `grants`: branch `agent.grant`, keyed `job_id`, labelled `job`; `search(text)` asks the agent's grant verb
    `{ op: 'search', text }`; `grant(id, path)` asks `{ op: 'add', job_id, path }`, answering `{ ok: true }` or a refusal
    as `{ ok: false, code, error }`; `revoke(id, path)` asks `{ op: 'delete', job_id, path }`; `stream(job)` takes the agent
    stream's grant rows (`{ agent: { table: 'grant', row } }`, removed when revoked), and no job row nor the node's own
    grants.

## What its test must try to break

- A title that shows the bug with only one of the two on.
- A checkbox that does not follow the stream, or follows the click instead.
- A state streamed before the app opened, handed as the whole set with no single job.
- A call that goes out as a raw verb instead of through the agent's interface.
- A config saved anywhere but the app's own state folder.
