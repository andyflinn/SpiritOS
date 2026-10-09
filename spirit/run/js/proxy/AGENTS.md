# proxy: the owner's list of websites and keys, for agents

The `proxy` namespace maintains relay-state/proxy.json, the owner's list of
which secret key may go to which website through net.fetch, and whether that
gate is open. On this node's disk (`wire: false`).

Described to agents (goal/G10.5): the two reads, proxy.search and proxy.get.
The writes (allow, remove, close, open) have no file here and are closed to
agents until a goal opens them.
