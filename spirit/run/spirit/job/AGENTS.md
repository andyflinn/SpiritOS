# jobs: this node's processes

The `jobs` namespace holds the node's jobs: the processes it started, server
processes and other local transient ones, and their tracking. It is not an api
hub: a server process is called by its verb on the flat apiDoor, and the
allow-table is the `auth` family. Local (`wire: false`).

Every verb has its <verb>.json beside api.js, its arguments as api.js declares them (goal/G47.4; Andy: "api.js and <verb>.json files match precisely"). Which verbs an agent may call is no longer said by a file being there or not: the agent app gates branches and verbs for agents, not the node (Andy, goal/G47.4).