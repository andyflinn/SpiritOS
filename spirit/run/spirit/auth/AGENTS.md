# auth: the owner's allow-table for members

The `auth` family holds who may call what on this node: one row per grant, a
member's key and an api path (`family` or `family.verb`). Its own node family
since goal/G30.6, beside the node's other families. The owner calls it on
loopback; a member reaches it only through a grant (apiDoor.js), as every
family.

Described to agents: the reads (query, search, peer) and the bundle and
branch tables (bundle, branch; goal/G41.14). The writes (grant,
revoke, relabel) have no file here and are closed to agents until a goal opens
them. `grant.warning.txt` is what the grants panel
(`spirit/element/grantsPanel.js`) shows before a grant of `auth.grant`.
