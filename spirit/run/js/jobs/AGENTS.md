# jobs: this node's processes, and the way to its servers, for agents

The `jobs` namespace holds the node's jobs (processes it started), the
owner's allow-table for members (jobs.auth*), and `jobs.api`, the one local
way to a server process: `{verb: 'jobs.api', ask}`, ask being `'api'` or
`{name: {verb: args}}`, answered through apiDoor exactly as a member's packet
is. Local (`wire: false`).

Described to agents (goal/G10.5): the reads (search, get, authQuery,
authSearch, authPeer) and jobs.api, which is how an agent reaches the desk.
The writes (create, update, cancel, delete, authGrant, authRevoke,
authRelabel) have no file here and are closed to agents until a goal opens
them.
