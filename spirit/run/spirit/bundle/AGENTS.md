# spirit.bundle: the node's bundles

The `spirit.bundle` branch holds the node's bundles: each a named set of branches and verbs, granted at once, owned by the node or by an app server. One of the three auth tables, each a branch of its own since goal/G49.21, with the same four verbs: search, get, add and delete. What a bundle holds is the `spirit.branch` table's.

Its handlers are the node's gate's, `spirit/grant/auth/script.js`. Every verb has its <verb>.json beside script.js, its arguments as script.js declares them, each checked by its spirit.type (goal/G49.21, box v25).
