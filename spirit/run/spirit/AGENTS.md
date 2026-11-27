# spirit: the root branch, for agents

The spirit branch is what this node says about itself and its one stream of what happens (goal/G49.23, box v22 Part 2: the node
and event branches' verbs move into the spirit branch). Local (`wire: false`).

What the node says about itself: its card (name, description, public key), its name and description, its debug flag, the
rotation of its cipher key.

- `spirit.card {}`: the node's card.
- `spirit.setName {name}`, `spirit.setDescription {description}`: its name and its description.
- `spirit.debug {debug}`: its debug flag.
- `spirit.rotateCipher {}`: a new cipher key.

Its one stream of what happens: the jobs (a server's published object among them), what a relay this node owns did, the
packets that arrive and the contact renames. Its subscribers are the node's own pages, its own processes and the owner's face.
Owner only, on the loopback table, like `fs`; a peer never gets a stream.

- `spirit.subscribe {}`: a stream, what is known now and then every event, each with its kind.
- `spirit.publish {id, status?, data?, logMessage?, app?}`: a process publishes its state or its object on its own job. The one
  path to publish (Andy, 2026-10-25).

Every verb has its <verb>.json beside spirit/script.js, its arguments as the script declares them (goal/G47.4; Andy: "api.js
and <verb>.json files match precisely"). Which verbs an agent may call is no longer said by a file being there or not: the agent
app gates branches and verbs for agents, not the node (Andy, goal/G47.4).
