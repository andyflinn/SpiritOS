# spirit/bundle/client/script.js — its own test

What a client knows of a node's bundles (goal/G49.21, box v24): the rows of node.db's bundle table, from the node's job
`spirit.bundle`, each changed row, gone when deleted. Owed since the rule *"every production script has its own test"*
(goal/G47.1, box v72). It runs beside the real `spirit/client/script.js`; the test reads through its reads alone.

- In node, `spirit.requireScript('spirit/bundle/script.js')` brings it, the one script that requires it, and it stands at
  `spirit.bundle.client`.
- A row of the job is kept by its id as `{ id, label, owner }`: id a number, label a string (empty when not named), the
  owner as the node said it (goal/G41.25), and a row that names no owner keeps none. A row changed replaces the one kept;
  `gone` lets it go. A row with no id, or a job of another id, keeps nothing.
- Reads: `row(id)` (null for no id), `rows()`, `watch(fn)` (id and row, undefined once gone; its release), `branch`
  under the node that served it. Another node's rows are filed under that node: on a page never among the page's node's,
  in a process the reads follow the node whose rows came last.

## What its test must try to break

- An owner made up for a row that named none; a gone row kept; a row of another job taken; two nodes mixed.
