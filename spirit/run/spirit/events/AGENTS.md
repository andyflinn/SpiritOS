# events: this node's one dispatcher

The `events` namespace is the node's one stream of what happens: the jobs (a
server's published object among them), what a relay this node owns did, the
packets that arrive and the contact renames. Its subscribers are the node's own
pages, its own processes and the owner's face. Owner only, on the loopback
table, like `fs`; a peer never gets a stream. Local (`wire: false`).

- `events.subscribe {}`: a stream, what is known now and then every event, each
  with its kind.
- `events.publish {id, status?, data?, logMessage?, app?}`: a process publishes
  its state or its object on its own job. The one path to publish (Andy,
  2026-10-25).

Described to agents (goal/G10.5): neither. Both are a process's own and a page's
own, and closed to agents until a goal opens them.
