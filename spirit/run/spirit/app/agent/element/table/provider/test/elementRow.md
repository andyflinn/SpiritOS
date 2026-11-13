# spirit/app/agent/element/table/provider/elementRow.js — its own test

One provider row in the page (goal/G41.4): its fields, handed to the tables' row element (`../rowElement.js`, tested in its
own folder), which edits them, saves each as it changes and deletes the row. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs in node on a window of its
own; the row element is a stand-in placed by the real `installSpiritElement` as its own file places it, keeping what it
was handed. The same world as the other tables' `elementRow` tests.

- Before it runs there is no `spirit.element.spirit.app.agent.element.table.provider.elementRow`; once it has, it stands
  there with `create`.
- As it loads it asks for the agent family's cache manager, `spirit.cacheManager('agent')` (goal/G41.28: its table's
  rows are the agent family's cache).
- `create(container, id, added, detail)` loads `../rowElement.js` itself (rule/26) and makes the row element in that
  container, told its table, `provider`, the id, `added` true only when it is `true`, and the title row's look,
  `detail.look('provider')` (null with no detail pane).
- Its fields are `label` (name), `url` (url), `apiKey` (secret), `model` (pick of model, of `providerId`).
- The API key is a secret field.
- Its last field is Model, a pick of the model table showing only the models whose `providerId` is this provider (goal/G41.21, box v17: *"a Model field at the bottom. It is a pick field ... showing only the models whose provider is this provider"*).
- Its mandatory fields are `icon`, `label`, `url` (goal/G41.21: *"provider: icon, label, valid URL"*).
- Its `destroy` destroys the row element it made; destroyed before the row element has loaded, it makes none.

## What its test must try to break

A field dropped, renamed or of another kind; a mandatory field the server names left out; the row element made in
another container or for another table; a row element made after its destroy.
