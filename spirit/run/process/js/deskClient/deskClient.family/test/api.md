# process/js/deskClient/deskClient.family/api.js

The deskClient server's interface (goal/G32.3): every verb deskClient serves, each argument with its rule, written to
spirit.js's standard (`'?'` optional). The spirit object checks every call against it before the call leaves
(`spirit.check`); deskAgentEar and publishData reach deskClient only through it.

## Requirements

- It exports `{ verbs }` and nothing else: it names no family of its own.
- Each rule is one of spirit.js's rules (`spirit.rules`).
- **Every verb listed is served**: a handler of deskClient.js, or `streamListener`, which appServer adds to a server that
  follows a stream (deskClient follows the desk's).
- `next { read? }`: read, a text, the key of the wake the agent last read (goal/G41.11); nothing else.
- `cache.dump {}`: takes no path (the file is fixed by the server).
- `desk { name, json?, kept? }`: the desk verb by name (an id, never `''`), its arguments as JSON text, `'{}'` when
  left out; kept a boolean.
- `setDesk { key }`: the key of the node that runs the desk, a peer's public key, required.
- `signoff` and `clearSignoff`: agent optional.
- `history.search`: text optional.
- `streamListener { json }`: one row of the desk's stream as JSON text, required.

## What its test must try to break

- A rule spirit.js does not know.
- A verb listed that deskClient does not serve.
- A desk ask with no verb, or its json sent as an object.
- A setDesk with something that is not a key.
