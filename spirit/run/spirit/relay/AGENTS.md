# relay: this node's relays, for agents

The `relay` namespace is the node's relationship with its relays: claiming a
seat, checking a partner, reading one of its relays (contact.search lists them,
relay: yes), and
the record of what each has reported over time. `wire: true`: a probe can
find a relay offline.

Described to agents (goal/G10.5): the reads, relay.get and relay.record
(relay.search went with goal/G40.11). relay.claim and relay.partnerCheck have no file here and are
closed to agents until a goal opens them.
