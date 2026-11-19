# relay: this node's relays, for agents

The `relay` namespace is the node's relationship with its relays: claiming a
seat, checking a partner, and reading one of its relays (contact.search lists
them, relay: yes). `wire: true`: a probe can find a relay offline.

Every verb has its <verb>.json beside api.js, its arguments as api.js declares them (goal/G47.4; Andy: "api.js and <verb>.json files match precisely"). Which verbs an agent may call is no longer said by a file being there or not: the agent app gates branches and verbs for agents, not the node (Andy, goal/G47.4).