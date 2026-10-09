# relay: this node's relays, for agents

The `relay` namespace is the node's relationship with its relays: claiming a
seat, checking a partner, searching and reading its configured relays, and
the record of what each has reported over time. `wire: true`: a probe can
find a relay offline.

Described to agents (goal/G10.5): the reads, relay.search, relay.get and
relay.record. relay.claim and relay.partnerCheck have no file here and are
closed to agents until a goal opens them.
