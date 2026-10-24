# owner: this node's puppets and their boxes, for agents

The `owner` namespace is the owner's remote control: owner.command sends one
signed command to one of his puppet nodes (`wire: true`), and owner.boxSearch
and owner.boxGet read what his servers' boxes carry.

Described to agents (goal/G10.5): the two box reads. owner.command has no
file here and is closed to agents: a command on a puppet is his alone.
