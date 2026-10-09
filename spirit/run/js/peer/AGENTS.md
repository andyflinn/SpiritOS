# peer: anybody who is not this node, for agents

The `peer` namespace reaches other nodes through a relay: peer.post sends a
payload to a peer, peer.search asks every relay who matches, peer.acquire
adds a confirmed key to the book. `wire: true`: every one of these fails the
same way when the box is offline.

Described to agents (goal/G10.5): peer.search, the read. peer.post and
peer.acquire have no file here and are closed to agents: a post in the
owner's name and a row in his book are his.
