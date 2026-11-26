# spirit.branch: what each bundle holds

The `spirit.branch` branch holds the rows of the node's bundles: each row one branch of the node's API in one bundle, and one verb of it or '' for the whole branch. One of the three auth tables, each a branch of its own since goal/G49.21, with the same four verbs: search, get, add and delete. The bundles themselves are the `spirit.bundle` table's.

Its handlers are the node's gate's, `spirit/grant/auth/script.js`. Every verb has its <verb>.json beside script.js, its arguments as script.js declares them, each checked by its spirit.type (goal/G49.21, box v25).
