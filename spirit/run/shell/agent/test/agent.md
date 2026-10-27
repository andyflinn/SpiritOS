# shell/agent/agent.js

The agent face app (goal/G41.1): the face of the agent server, built on the `workBench` element. It runs on the face
on loopback and through a relay alike.

No agents talk to each other through it: each agent sees itself as the only agent and user of the node (goal/G3.1,
2026-10-02, and G41.1's Q1).

## Its files

- `shell/agent/agent.js`, the app.
- `shell/agent/agent.json`, its manifest, naming its server, `agent`.
- `shell/agent/agent.js.sidecar.json`, its face mark: `face.app` true, with its name, icon and description.

## Its state

- `relay-state/shell/agent/config.json`, its own, out of git: `{ "showDebug": <true or false> }`, whether the window's
  title bar shows the agent server's DEBUG state.

## Requirements

- It mounts through `spirit.shell.activateApp({ mount(container, api) })`.
- Its whole app area is one workBench: it hands `workBench.create` a box that takes the shell's `fill` class (rule/16).
- It bootstraps its own components (Andy: "the shell should not know that. every app needs to bootstrap its own
  components."): with no workBench on the page, it loads `shell/js/workBench.js` through `spirit.require`, then builds.
- The workBench has one tool on its left strip and one on its right.
- The left tool keeps `relay-state/shell/agent/config.json`:
  - At mount it reads the file through `spirit.fs.loadFile`; with none, `showDebug` is false.
  - It draws one checkbox, checked when `showDebug` is true.
  - Changing the checkbox saves the file through `spirit.fs.saveFile`, with the new `showDebug`.
- The right tool sets the agent server's DEBUG state:
  - It draws one checkbox, and changing it calls `api.verb('agent.debug', { on })` with the checkbox's state.
  - The checkbox follows the server's state as it arrives on the stream (`api.onJobs`): a job whose app is
    `{ agent: { debug } }`.
- The title bar (`api.setScreenTitle`) says DEBUG while `showDebug` is true and the server's DEBUG state is on, and does
  not say it otherwise. It follows both as they change.

## What its test must try to break

- A title that says DEBUG with only one of the two on.
- A checkbox that does not follow the stream.
- A config saved anywhere but the app's own state folder.
