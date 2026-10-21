# contact: this node's address book, for agents

The `contact` namespace is the book this node keeps about others: who is
held, accepted, blocked, labelled or forgotten, and the policy for unknown
senders. On this node's disk (`wire: false`). One exception, goal/G30.19: contact.search also
starts a network search across the relays, whose rows stream as the peer-search job and land
in the shadow, so a later search finds them; its own answer never waits for a relay.

Described to agents (goal/G10.5): the reads, contact.search, contact.get and
contact.senders. The writes (block, unblock, accept, label, forget,
setSenders) have no file here and are closed to agents until a goal opens
them.
