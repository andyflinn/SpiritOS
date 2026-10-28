# process/js/agent/agent.js

The agent server (goal/G41.1): the server process behind the agent face app. It keeps all of the app's state, in
`agent.db`, an SQLite database, and streams that state to its clients. In this item its state is its DEBUG state.

No agents talk to each other through it: each agent sees itself as the only agent and user of the node (goal/G3.1,
2026-10-02, and G41.1's Q1).

## Its files

- `process/js/agent/agent.js`, the server, started by the node.
- `process/js/agent/agent.json`, its manifest: a server (`kind: "server"`) the node operates (`operated: "node"`). It
  names no `runs`.
- No sidecar beside its code, and its manifest names neither `runs` nor `intrinsic`: whether a node runs it is that
  node's own state, `relay-state/process/agent/agent.js.sidecar.json` (`face.home`, goal/G41.1, box v16-v17).
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

## goal/G41.4 (box v22): the data set of agent.db

- **Five tables in agent.db**, camelCase as the shadow-roll is (cw): every table has `id` (an ed25519 public key, as the
  shadow-roll keys a row), `privateKey`, `sealPublicKey`, `sealPrivateKey`, `label`, `description`, keyed by `id` alone;
  provider adds `url`, `apiKey`; model `providerId`, `modelName`, `capabilities`; persona `persona`; job `loop`, `job`.
  grant is node's grants exactly: `job_id`, `path`, keyed by both (spirit/nodeStore.js:502).
- **One verb per table** (provider, model, persona, job, grant), flat as every family verb is (cw): `{op, ...fields}`,
  op one of add (answers the new id), set, delete, get (the row without its secrets, `apiKeySet` in place of the key)
  and search (items and more); any other op refused.
- **The key set at add-row** (Andy: "including the rest of the key-set stored on that table row"), the shadow-roll's
  kind (spirit/relayAuth.js generateIdentity).
- **No secret leaves the process** (Andy: API_KEY "will never reach the browser or any place outside of the agent
  process except the model providers API"; "The private halves of that set stay in the agent process"): no answer of
  add, set, get or search carries the API key or a private key.
- **The folders**: process/js/agent/table/<name>/ with server.js, elementTable.js and elementRow.js, for each table;
  the table servers publish their rows.
- Not asserted yet: the stream's rows carry no secret (a test server's stream reaches no node); the workBench icons.
