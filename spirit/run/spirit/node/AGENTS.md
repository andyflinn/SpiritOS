# node: this box itself, for agents

The `node` namespace is what this node says about itself: its card (name,
description, public key), its name and description, its debug flag, the
rotation of its cipher key, and the shell it names at home and on its face
(node.shell, goal/G43.18). Local (`wire: false`).

Every verb has its <verb>.json beside api.js, its arguments as api.js declares them (goal/G47.4; Andy: "api.js and <verb>.json files match precisely"). Which verbs an agent may call is no longer said by a file being there or not: the agent app gates branches and verbs for agents, not the node (Andy, goal/G47.4).