# config: what this node includes, for agents

The `config` namespace reads and sets the include list (relay-state/
include.json): which process servers and shell apps this node runs. Local
(`wire: false`).

Described to agents (goal/G10.5): config.searchModules, the read. The write,
config.setModules, has no file here and is closed to agents until a goal
opens it.
