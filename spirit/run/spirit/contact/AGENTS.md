# contact: this node's address book, for agents

The `contact` namespace is the book this node keeps about others: who is
accepted, blocked, labelled or forgotten. A stranger is always ignored
(goal/G43.17). On this node's disk (`wire: false`). One exception, goal/G30.19: contact.search also
starts a network search across the relays, whose rows stream as the peer-search job and land
in the shadow, not listed; its own answer never waits for a relay.

A relay is a row of the book too, and its verbs are the book's (goal/G49.11, the node's relay branch gone): `add` puts a
relay on the list by its url once its card answers; `claim`, `face`, `join` and `leave` ask that relay through peerPost and
keep its answer on the row, each naming the relay by its row's public key; `get` adds a relay row's last report, and
`forget` takes a relay off the list first, with the refusals removing a relay always had. These reach the relay, so for
them an offline box fails the call.

Every verb has its <verb>.json beside api.js, its arguments as api.js declares them (goal/G47.4; Andy: "api.js and <verb>.json files match precisely"). Which verbs an agent may call is no longer said by a file being there or not: the agent app gates branches and verbs for agents, not the node (Andy, goal/G47.4).