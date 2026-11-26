# spirit.grant: the owner's allow-table for members

The `spirit.grant` branch holds who may call what on this node: one row per grant, a member's key and an api path (a branch, or a branch and one of its verbs). It is one of the three auth tables, each a branch of its own since goal/G49.21, with the same four verbs: search, get, add and delete. The owner calls it on loopback; a member reaches it only through a grant, as every branch.

The table's handlers are in `auth/script.js` here, the node's gate, which also answers the bundle and branch tables (`spirit/bundle/`, `spirit/branch/`).

Every verb has its <verb>.json beside script.js, its arguments as script.js declares them (goal/G47.4; Andy: "api.js and <verb>.json files match precisely"), each checked by its spirit.type (goal/G49.21, box v25).
