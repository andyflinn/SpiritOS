# spirit/grant/client/script.js — its own test

What a client knows of a node's grants (goal/G49.21, box v24): the rows of node.db's grant table, from the node's job
`spirit.grant`, each grant given or taken back. Owed since the rule *"every production script has its own test"*
(goal/G47.1, box v72). It runs beside the real `spirit/client/script.js`; the test reads through its reads alone.

- In node, `spirit.requireScript('spirit/grant/script.js')` brings it, the one script that requires it, and it stands at
  `spirit.grant.client`.
- `grantKey(key, path)` is a grant's id: the key, a newline, the path.
- A grant given is kept whole by that id, the same key on another path another grant; given again it replaces the one
  kept; `gone` lets it go. A row with no key or no path, or a job of another id, keeps nothing.
- Reads: `row(id)` (null for no id), `rows()`, `watch(fn)` (id and row, undefined once gone; its release), `branch`
  under the node that served it. Another node's grants are filed under that node: on a page never among the page's node's,
  in a process the reads follow the node whose rows came last.

## What its test must try to break

- Two paths of one key kept as one grant; a grant taken back kept; a row of another job taken; two nodes mixed.
