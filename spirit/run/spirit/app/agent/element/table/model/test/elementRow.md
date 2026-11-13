# spirit/app/agent/element/table/model/elementRow.js — its own test

One model row in the page (goal/G41.4): its fields, handed to the tables' row element (`../rowElement.js`, tested in its
own folder), which edits them, saves each as it changes and deletes the row. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs in node on a window of its
own; the row element is a stand-in placed by the real `installSpiritElement` as its own file places it, keeping what it
was handed. The same world as the other tables' `elementRow` tests.

- Before it runs there is no `spirit.element.spirit.app.agent.element.table.model.elementRow`; once it has, it stands
  there with `create`.
- As it loads it asks for the agent family's cache manager, `spirit.cacheManager('agent')` (goal/G41.28: its table's
  rows are the agent family's cache).
- `create(container, id, added, detail)` loads `../rowElement.js` itself (rule/26) and makes the row element in that
  container, told its table, `model`, the id, `added` true only when it is `true`, and the title row's look,
  `detail.look('model')` (null with no detail pane).
- Its fields are `label`, `providerId` (shown by the provider table's row), `capabilities`, every one output only.
- Every field is output only (goal/G41.21: *"model details, capabilites, is output only"*).
- Its label is the model's name as the provider gives it, shown as Model (Andy: *"the label hold the model name as provided by the provider, and is output only in the models UI"*).
- Its provider is shown from `providerId`, by the provider table's row.
- Its `destroy` destroys the row element it made; destroyed before the row element has loaded, it makes none.

## What its test must try to break

A field dropped, renamed or of another kind; a mandatory field the server names left out; the row element made in
another container or for another table; a row element made after its destroy.
