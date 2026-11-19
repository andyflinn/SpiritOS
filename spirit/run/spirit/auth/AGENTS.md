# auth: the owner's allow-table for members

The `auth` family holds who may call what on this node: one row per grant, a
member's key and an api path (`family` or `family.verb`). Its own node family
since goal/G30.6, beside the node's other families. The owner calls it on
loopback; a member reaches it only through a grant (apiDoor.js), as every
family.

Every verb has its <verb>.json beside api.js, its arguments as api.js declares them (goal/G47.4; Andy: "api.js and <verb>.json files match precisely"). Which verbs an agent may call is no longer said by a file being there or not: the agent app gates branches and verbs for agents, not the node (Andy, goal/G47.4).