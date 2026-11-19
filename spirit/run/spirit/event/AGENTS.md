# events: this node's one dispatcher

The `events` namespace is the node's one stream of what happens: the jobs (a
server's published object among them), what a relay this node owns did, the
packets that arrive and the contact renames. Its subscribers are the node's own
pages, its own processes and the owner's face. Owner only, on the loopback
table, like `fs`; a peer never gets a stream. Local (`wire: false`).

- `event.subscribe {}`: a stream, what is known now and then every event, each
  with its kind.
- `event.publish {id, status?, data?, logMessage?, app?}`: a process publishes
  its state or its object on its own job. The one path to publish (Andy,
  2026-10-25).

Every verb has its <verb>.json beside api.js, its arguments as api.js declares them (goal/G47.4; Andy: "api.js and <verb>.json files match precisely"). Which verbs an agent may call is no longer said by a file being there or not: the agent app gates branches and verbs for agents, not the node (Andy, goal/G47.4).