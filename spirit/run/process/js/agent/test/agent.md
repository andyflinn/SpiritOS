# process/js/agent/agent.js

The agent server (goal/G41.1): the server process behind the agent face app. It keeps all of the app's state, in
`agent.db`, an SQLite database, and streams that state to its clients. In this item its state is its DEBUG state.

No agents talk to each other through it: each agent sees itself as the only agent and user of the node (goal/G3.1,
2026-10-02, and G41.1's Q1).

## Its files

- `process/js/agent/agent.js`, the server, started by the node.
- `process/js/agent/agent.json`, its manifest: a server (`kind: "server"`) the node operates (`operated: "node"`), run
  at home (`runs` names `"home"`), so the node starts it for its face app.
- `process/js/agent/agent.family/api.js`, its interface: the verb `debug` with `on`, a `bool`.
- `process/js/agent/agent.family/debug.json`, the verb's description and request.

## Its state

- In the folder the node hands it as `--state`, which is `relay-state/process/agent/` on a node: never in git.
- `agent.db` is created there at start, an SQLite database.
- `config.json` there holds `{ "debug": <true or false> }`.

## Requirements

- It starts on the node's pipe (`--pipe`) and its `--state` folder, and answers there.
- `agent.debug {on}` maintains the existing debug state of the server, the one appServer's own `DEBUG` verb switches,
  not a second one (Andy, Q4): after `debug {on: true}`, `DEBUG {}` answers `debug: true`, and the other way round.
- `debug {on}` writes `config.json` with the new state, and answers `{ debug }`.
- A `debug` whose `on` is not true or false is refused, and changes nothing.
- The state persists across restarts: started again on the same `--state`, the server reads `config.json` and its DEBUG
  state is what it was. With no `config.json`, DEBUG starts off.
- It streams its state as `{ agent: { debug } }`: it serves with a publisher whose bootstrap hands a subscriber the
  state, and `debug` publishes the new state. There is no read verb: the page reads the state from the stream.

## What its test must try to break

- A DEBUG state kept apart from the built-in one.
- A restart that forgets the state.
- A `debug` with a value that is not true or false.
