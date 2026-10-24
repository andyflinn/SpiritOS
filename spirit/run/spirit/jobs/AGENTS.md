# jobs: this node's processes

The `jobs` namespace holds the node's jobs: the processes it started, server
processes and other local transient ones, and their tracking. It is not an api
hub: a server process is called by its verb on the flat apiDoor, and the
allow-table is the `auth` family. Local (`wire: false`).

Described to agents (goal/G10.5): the reads (search, get). The writes (create,
update, cancel, delete) have no file here and are closed to agents until a goal
opens them.
