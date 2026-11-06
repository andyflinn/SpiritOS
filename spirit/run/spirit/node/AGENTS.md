# node: this box itself, for agents

The `node` namespace is what this node says about itself: its card (name,
description, public key), its name and description, its debug flag, the
rotation of its cipher key, and the shell it names at home and on its face
(node.shell, goal/G43.18). Local (`wire: false`).

Described to agents (goal/G10.5): node.card, the read. The writes (setName,
setDescription, debug, rotateCipher) and node.shell have no file here and are
closed to agents until a goal opens them.
