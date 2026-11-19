# contact: this node's address book, for agents

The `contact` namespace is the book this node keeps about others: who is
accepted, blocked, labelled or forgotten. A stranger is always ignored
(goal/G43.17). On this node's disk (`wire: false`). One exception, goal/G30.19: contact.search also
starts a network search across the relays, whose rows stream as the peer-search job and land
in the shadow, not listed; its own answer never waits for a relay.

Every verb has its <verb>.json beside api.js, its arguments as api.js declares them (goal/G47.4; Andy: "api.js and <verb>.json files match precisely"). Which verbs an agent may call is no longer said by a file being there or not: the agent app gates branches and verbs for agents, not the node (Andy, goal/G47.4).