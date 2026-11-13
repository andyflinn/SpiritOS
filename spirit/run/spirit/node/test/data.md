# spirit/node/data.js — its own test

What a client knows of a node itself (goal/G41.28): its api tree and verbs as the selectors read them (Andy, Q7: *"Shall
the app-server selector keep the node's api tree in an apiTree branch of spirit.data, read again when a server job
changes, and the family, verb and app-server selectors draw from it?"* *"yes."*), and its card. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs beside the
real `spirit/data.js`, with a planted `apiTreeIndex`; the test reads through `spirit.data.node.data` alone.

- In node, `spirit.cacheManager('node')` finds it.
- `card.keep` keeps node.card's answer, its name and description; a field a save stored is merged in; an answer that
  is not ok, or no object, keeps nothing. `card.get()`, `card.watch(fn)` (and its release).
- `keepTree(tree, index)` keeps each family the index reads and each verb as `family.verb`; read again, the tree
  replaces both branches whole; with no index it keeps nothing; no tree is a tree with no families.
- `families()`, `verbs()`, `treeBranch`, `verbsBranch`.

## What its test must try to break

- A refused card answer written over the card; a save that drops the other field.
- A tree read again that only adds.
