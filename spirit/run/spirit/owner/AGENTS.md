# owner: this node's puppets and their boxes, for agents

The `owner` namespace is the owner's remote control: owner.command sends one
signed command to one of his puppet nodes (`wire: true`), and owner.boxSearch
and owner.boxGet read what his servers' boxes carry.

Every verb has its <verb>.json beside api.js, its arguments as api.js declares them (goal/G47.4; Andy: "api.js and <verb>.json files match precisely"). Which verbs an agent may call is no longer said by a file being there or not: the agent app gates branches and verbs for agents, not the node (Andy, goal/G47.4).