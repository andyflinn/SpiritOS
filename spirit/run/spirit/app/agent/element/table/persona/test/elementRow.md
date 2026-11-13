# spirit/app/agent/element/table/persona/elementRow.js — its own test

One persona row in the page (goal/G41.4): its fields, handed to the tables' row element (`../rowElement.js`, tested in its
own folder), which edits them, saves each as it changes and deletes the row. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs in node on a window of its
own; the row element is a stand-in placed by the real `installSpiritElement` as its own file places it, keeping what it
was handed. The same world as the other tables' `elementRow` tests.

- Before it runs there is no `spirit.element.spirit.app.agent.element.table.persona.elementRow`; once it has, it stands
  there with `create`.
- As it loads it asks for the agent family's cache manager, `spirit.cacheManager('agent')` (goal/G41.28: its table's
  rows are the agent family's cache).
- `create(container, id, added, detail)` loads `../rowElement.js` itself (rule/26) and makes the row element in that
  container, told its table, `persona`, the id, `added` true only when it is `true`, and the title row's look,
  `detail.look('persona')` (null with no detail pane).
- Its fields are `label` (name), `persona` (code), `bundle` (bundle), `provider` (pick of provider).
- The bundle is chosen by the bundle selector, as the job's (goal/G41.21, box v19; Andy: *"and where the fuck is my bundle field in persona-table and the fucking picker for a bundle with the persona?"*).
- The provider is the same provider pick the job's detail has (goal/G41.26; Andy: *"it's detail provides the same provider-FUCKING-Selector in drop down mode, that the job detail panel provides for the agent.job.provider"*).
- Its mandatory fields are `icon`, `label` (goal/G41.21).
- Its `destroy` destroys the row element it made; destroyed before the row element has loaded, it makes none.

## What its test must try to break

A field dropped, renamed or of another kind; a mandatory field the server names left out; the row element made in
another container or for another table; a row element made after its destroy.
