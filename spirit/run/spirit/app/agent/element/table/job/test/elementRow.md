# spirit/app/agent/element/table/job/elementRow.js — its own test

One job row in the page (goal/G41.4): its fields, handed to the tables' row element (`../rowElement.js`, tested in its
own folder), which edits them, saves each as it changes and deletes the row. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs in node on a window of its
own; the row element is a stand-in placed by the real `installSpiritElement` as its own file places it, keeping what it
was handed. The same world as the other tables' `elementRow` tests.

- Before it runs there is no `spirit.element.spirit.app.agent.element.table.job.elementRow`; once it has, it stands
  there with `create`.
- As it loads it asks for the agent family's cache manager, `spirit.cacheManager('agent')` (goal/G41.28: its table's
  rows are the agent family's cache).
- `create(container, id, added, detail)` loads `../rowElement.js` itself (rule/26) and makes the row element in that
  container, told its table, `job`, the id, `added` true only when it is `true`, and the title row's look,
  `detail.look('job')` (null with no detail pane).
- Its fields are `label` (name), `loop` (bool), `job` (code), `bundle` (bundle), `provider` (pick of provider), `persona` (pick of persona).
- The bundle, the job's grant, is chosen by the bundle selector (goal/G41.21, box v17: *"with a bundleSelector in dropdown mode"*, *"That bundle is the job's grant"*).
- The provider and the persona are each a pick field of their own table (goal/G41.21, box v17).
- Its mandatory fields are `icon`, `label`, as its server names them (goal/G41.21: *"# mandatory fields (server AND ui)"*).
- Its `destroy` destroys the row element it made; destroyed before the row element has loaded, it makes none.

## What its test must try to break

A field dropped, renamed or of another kind; a mandatory field the server names left out; the row element made in
another container or for another table; a row element made after its destroy.
