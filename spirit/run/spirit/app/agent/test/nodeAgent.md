# spirit/app/agent/nodeAgent.js

The agent server (goal/G41.1): the server process behind the agent face app. It keeps all of the app's state, in
`agent.db`, an SQLite database, and streams that state to its clients: the rows of its four tables.

No agents talk to each other through it: each agent sees itself as the only agent and user of the node (goal/G3.1,
2026-10-02, and G41.1's Q1).

## Its files

- `spirit/app/agent/nodeAgent.js`, the server. The node starts `agent.js` (`./agent.md`), which loads it.
- `spirit/app/agent/agent.json`, its manifest, in the new shape: `node.mount` true, no `kind`, no `operated`.
- `spirit/app/agent/api.js`, its interface, and one `<verb>.json` per verb beside it: one verb per table, provider, model, persona and job, and the publisher's subscribe and unsubscribe; no `debug`
  (goal/G43.15, below).

## Its state

- In the folder the node hands it as `--state`, which is `spirit/state/agent/data/` on a node: never in git.
- `agent.db` is created there at start, an SQLite database.
- No `config.json` is written there (goal/G43.15).

## Requirements

- It starts on the node's pipe (`--pipe`) and its `--state` folder, and answers there.
- Its DEBUG is appServer's own `DEBUG`, as every server's, kept by the node across restarts (goal/G43.15, below).
- It streams its state: it serves with a publisher (family `agent`, its bootstrap an empty list), whose `subscribe` and
  `unsubscribe` its `api.js` declares (goal/G43.32; Andy: *"for now, it needs to declare them in api.js"*), and each table
  publishes a row as it changes, `{ agent: { table, row } }` or `{ agent: { table, id, removed } }`. There is no read
  verb: the page reads the rows from the stream.

## Requirements (goal/G41.21, box v17)

- **agent.grant is removed altogether**: agent.db holds four tables, provider, model, persona and job; an agent.db that
  held a grant table from before loses it at start (*"its rows in agent.db are dropped"*). The interface declares four
  verbs, no grant, and `spirit/app/agent/table/grant` is gone.
- The provider table has `model`; the job table `bundle`, `provider` and `persona`.

### No description, no model name (goal/G41.21)

Andy: *"ALL, drop the description for ALL tables. it does NOTHING AND IS USELESS."*, *"ALL, from all agent-tables I mean..."*. No agent table has a description column. Andy: *"i decided that model, does NOT need a name field, which i also NEVER FUCKING ASKED FOR, and the label hold the model name as provided by the provider, and is output only in the models UI."*: the model table has no model name column, its label holds it.

## What its test must try to break

- A `debug` verb or a `config.json` of its own (goal/G43.15).

## goal/G41.4 (box v22): the data set of agent.db

The grant table, the description column and the model name are gone since goal/G41.21 (above); what follows says the
tables as they are now.

- **Four tables in agent.db**, camelCase as the shadow-roll is (cw): every table has `id` (an ed25519 public key, as the
  shadow-roll keys a row), `privateKey`, `sealPublicKey`, `sealPrivateKey`, `icon`, `label`, keyed by `id` alone;
  provider adds `url`, `apiKey`, `unusable`, `model`; model `providerId`, `capabilities`; persona `persona`, `bundle`, `provider`;
  job `loop`, `job`, `bundle`, `provider`, `persona`.
- **One verb per table** (provider, model, persona, job), flat as every family verb is (cw): `{op, ...fields}`,
  op one of add (answers the new id), set, delete, get (the row without its secrets, `apiKeySet` in place of the key)
  and search (items and more); any other op refused.
- **The key set at add-row** (Andy: "including the rest of the key-set stored on that table row"), the shadow-roll's
  kind (spirit/relayAuth.js generateIdentity).
- **No secret leaves the process** (Andy: API_KEY "will never reach the browser or any place outside of the agent
  process except the model providers API"; "The private halves of that set stay in the agent process"): no answer of
  add, set, get or search carries the API key or a private key.
- **The folders**: spirit/app/agent/table/<name>/ with server.js, elementTable.js and elementRow.js, for provider,
  model, persona and job; no grant folder (goal/G41.21). The table servers publish their rows.
- Not asserted yet: the stream's rows carry no secret (a test server's stream reaches no node); the workBench icons.
- A grant table or verb left, or an old grant table kept at start.
- A description column left on an agent table; a model name column.

## No debug of its own (goal/G43.15)

- Its interface declares no `debug` verb, and `api/debug.json` is gone. A `debug {on}` is refused.
- appServer's `DEBUG` switches it, as for any server, and no `config.json` is written in its `--state` folder.
