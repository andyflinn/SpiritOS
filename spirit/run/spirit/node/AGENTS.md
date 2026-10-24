# node: this box itself, for agents

The `node` namespace is what this node says about itself: its card (name,
description, public key), its name and description, its debug flag, and the
rotation of its cipher key. Local (`wire: false`).

Described to agents (goal/G10.5): node.card, the read. The writes (setName,
setDescription, debug, rotateCipher) have no file here and are closed to
agents until a goal opens them.
