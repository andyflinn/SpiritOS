# auth: the owner's allow-table for members

The `auth` family holds who may call what on this node: one row per grant, a
member's key and an api path (`family` or `family.verb`). Its own node family
since goal/G30.6, beside node, fs, jobs, peer and relay. Local (`wire: false`).

Described to agents: the reads (query, search, peer). The writes (grant,
revoke, relabel) have no file here and are closed to agents until a goal opens
them. `grant.warning.txt` is what the Grants app shows before a grant of
`auth.grant`.
