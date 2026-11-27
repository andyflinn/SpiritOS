# spirit/branch/client/script.js — its own test

What a client knows of what a node's bundles hold (goal/G49.21, box v24): the rows of node.db's branch table, from the
node's job `spirit.branch`, each changed row, gone when deleted. Owed since the rule *"every production script has its own
test"* (goal/G47.1, box v72). It runs beside the real `spirit/client/script.js`; the test reads through its reads alone.

- In node, `spirit.requireScript('spirit/branch/script.js')` brings it, the one script that requires it, and it stands at
  `spirit.branch.client`.
- A row of the job is kept by its id as `{ id, bundle, family, verb }`, id and bundle numbers, family and verb strings
  (empty when not named), nothing else of the row. A row changed replaces the one kept; `gone` lets it go. A row with no
  id, or a job of another id, keeps nothing.
- Reads: `row(id)` (null for no id), `rows()`, `watch(fn)` (id and row, undefined once gone; its release), `branch`
  under the node that served it. Another node's rows are filed under that node: on a page never among the page's node's,
  in a process the reads follow the node whose rows came last.

## What its test must try to break

- A field of the row kept that the table does not have; a gone row kept; a row of another job taken; two nodes mixed.
