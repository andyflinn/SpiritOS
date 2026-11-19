# peer: anybody who is not this node, for agents

The `peer` namespace reaches other nodes through a relay: peer.post sends a
payload to a peer, peer.acquire adds a confirmed key to the book. Who is
out there is contact.search's to answer (goal/G30.19; peer.search is gone). `wire: true`: every one of these fails the
same way when the box is offline.

Every verb has its <verb>.json beside api.js, its arguments as api.js declares them (goal/G47.4; Andy: "api.js and <verb>.json files match precisely"). Which verbs an agent may call is no longer said by a file being there or not: the agent app gates branches and verbs for agents, not the node (Andy, goal/G47.4).