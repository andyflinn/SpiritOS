# spirit/app/agent/element/table/model/elementTable.js — its own test

The model table in the page (goal/G41.4): a model of a provider, its rows in the tables' shared element
(`../tableElement.js`, tested in its own folder), a row picked opening in its editor (`./elementRow.js`), and the Ask
form at the top (goal/G41.26, goal/G41.27). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs in node on a window of its own, its container a small tree
of nodes, since it moves its form in under the shared table's title row; the shared element, the row editor, the
rowForm, the busyButton and the agent family are stand-ins that keep what they were handed. The same world as the other
tables' `elementTable` tests, with the Ask form's parts.

- Before it runs there is no `spirit.element.spirit.app.agent.element.table.model.elementTable`; once it has, it stands
  there with `create`.
- `create(container, detail)` loads what it uses itself (rule/26): the shared element, its row editor, the search, the
  busyButton and the rowForm. It makes the shared element in its list, told its table, `model`, and the detail pane.
- No Add (Andy, on G41.18: *"get RID of [Add a Model] button in the left panes model mode. NOT required."*).
- The list shows `[icon] "model-name"` (goal/G41.18, box v17): the provider's icon the server sends with the row
  (`providerIcon`), then the model, sorted as text.
- A row picked opens in the model row editor: `row(box, id, added)` makes `elementRow.create(box, id, added, detail)`.
- The Ask form is a rowForm, `❓` and its button `Ask` (Andy: *"agent: left panel. [❓] [Pick a provider ▾] [Ask]"*), the
  providerSelector in dropdown mode in its span (the provider table's search, *"Pick a provider"*).
- The title row comes first (Andy, on G41.26: *"the title row "🧠Models" must come before the "from [🛖 Unsloth Studio ▾]
  [Ask] row."*): the form, then its note, under the shared table's title.
- Ask is a busy button (goal/G41.23). With no provider picked it asks nothing; with one, it asks `provider { op: 'ask',
  id }`, which updates the model table (Andy: *"the [Ask] button will no longer spit out a list, and simply update the
  agent.model table"*). A refusal is said on one line, the provider's reason, as the shared element's `whyOf` words it;
  the next Ask clears it; after its destroy nothing is said.
- `refresh` refreshes the shared table; `destroy` destroys the provider dropdown and the shared table. Each table it
  makes has ids of its own. Before its parts have loaded, refresh throws nothing, and destroyed then it makes no table.

## What its test must try to break

An Add button back; the form above the title row; Ask asking with no provider picked, or answering a list instead of
updating the table; a refusal not said, or said after its destroy; two tables on a page sharing ids.
