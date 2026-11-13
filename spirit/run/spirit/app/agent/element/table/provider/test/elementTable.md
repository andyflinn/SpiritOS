# spirit/app/agent/element/table/provider/elementTable.js — its own test

The provider table in the page (goal/G41.4): its rows in the tables' shared element (`../tableElement.js`, tested in its
own folder), a row picked opening in its editor (`./elementRow.js`) in the page's detail pane. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs in node
on a window of its own; the shared element and the row editor are stand-ins placed by the real `installSpiritElement` as
their own files place them, keeping what they were handed. The same world as the other tables' `elementTable` tests.

- Before it runs there is no `spirit.element.spirit.app.agent.element.table.provider.elementTable`; once it has, it stands
  there with `create`, and the row editor keeps its own place beside it.
- `create(container, detail)` loads the shared element and its own row editor itself (rule/26), and makes the shared
  element in that container, told its table, `provider`, and the page's detail pane.
- A row picked opens in the provider row editor: `row(box, id, added)` makes `elementRow.create(box, id, added, detail)`
  and answers it.
- `refresh` refreshes the shared table, `destroy` destroys it; before its parts have loaded, refresh throws nothing, and
  destroyed then it makes no table.

## What its test must try to break

The shared table made for another table, or without the detail pane; a row opened in another table's editor, or without
the detail pane; a table made after its destroy.
