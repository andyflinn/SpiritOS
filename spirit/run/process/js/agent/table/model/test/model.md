# model/

`spirit/run/process/js/agent/table/model/` is the model table (goal/G41.4): one model of one provider. Its test is
`./model.js`. What every table shares is specified in `../../test/`.

Andy, box v22: *"a model table, keyed by ID same as the shadow-roll (with Label and Description, provider-key, and
model-name and capabilities)"*. goal/G41.18 fills it from the providers: the provider table's ask
(`../../provider/test/provider.md`), asked from the Ask form at the top of this table's list (goal/G41.26).

## Requirements

- It has `server.js`, `elementTable.js` and `elementRow.js`.
- `server.js(ctx)` makes the `model` table on `ctx.db` with the shared rowTable. Its columns are the key set, the icon,
  label and description, then `providerId`, `modelName` and `capabilities`, and nothing else.
- `providerId` is a provider row's id. An add or a set naming a provider that is not there is refused, saying so, and
  the provider kept.
- `capabilities` is a list.
- **A model is shown with its provider's icon** (goal/G41.18; Andy, box v17: *"the model will [icon] \"model-name\",
  where the [icon] will be the provider-icon, associated with the provider-key on the model row"*): every row the server
  shows, by get, search or the stream, carries `providerIcon`, the icon of its provider row, empty for a model with no
  provider. It is shown, not kept: the table has no such column. The server says it with the row as the grant server
  says a grant's job (goal/G41.16), so the list draws only what the server sends (rule/19).
- **A search answers the id and what the list shows, nothing else** (goal/G41.18; Andy: *"only the ID and the fields
  shown in a table, that's all it needs."*): `id`, `modelName` and `providerIcon`. The editor reads the rest by get. Not asserted: a model shown
  again when its provider's icon changes.
- `elementTable.js` registers `spirit.elements.modelTable.create(container, api, detail)`:
  - It requires the shared element and its own `elementRow.js`.
  - It builds on `agentTable` for the model table, with the page's api and detail pane, and no Add (`add: false`;
    Andy, on G41.18: *"get RID of [Add a Model] button in the left panes model mode. NOT required."*): its rows come
    from the providers.
  - Its list shows each model by its provider's icon and its model name: the columns it hands are `providerIcon`, then
    `modelName` (goal/G41.18).
  - **The Ask form at the top** (goal/G41.26, Andy: *"The form \"from [Pick a provider ▾] [Ask]\" moves to the top of the
    left pane (🧠Models) and replaces that panes [provider models] buttons. the center pane panel goes. the [Ask] button
    will no longer spit out a list, and simply update the agent.model table"*):
    - the pane reads `from`, a providerSelector:dropdown (a probabilitySearch dropdown of the provider table), then an
      Ask button; the model list is drawn below it, never over it. It loads the search element and the busyButton itself;
    - the list is handed no `provider models` button; `./updatePanel.js` and its test are gone, and nothing loads it;
    - Ask with no provider chosen asks nothing; with one, it calls `provider { op: 'ask', id }` and shows no list: the
      model table it updated is the list below;
    - Ask is a busyButton, its request waiting until the provider answers (goal/G41.23).
  - A row it opens is a `modelRow`.
- `elementRow.js` registers `spirit.elements.modelRow.create(container, api, id, added, detail)`:
  - It builds on `agentRow` with the model table's look.
  - Its fields are the label, the description, the provider, the model name, and the capabilities as a list.
  - The provider is picked from a search of the provider table.

- **elementRow.js takes the model table's rows from the stream itself** (goal/G41.16; Andy: *"get rid of thos FUCKING data.js
  scripts"*): its page files require no data script; a row of the agent stream (`{ agent: { table: 'model', row } }`,
  module `process/js/agent`) lands at `agent.model/<id>` and the branch's watcher hears it; a changed row is merged; one
  removed, by its id, is gone; another table's rows, another module's, and a row with no id write nothing.

### The provider shown, never picked (goal/G41.21)

Andy: *"In model, the fucking <provider> field is OUTPUT ONLY. I NEVER ordered a fucking picker for that............."*. The model's detail shows its provider (kind `output`, the provider table's row by its icon and label); it is no picker.

### The model's label is the model name, shown only (goal/G41.21)

Andy: *"i decided that model, does NOT need a name field, which i also NEVER FUCKING ASKED FOR, and the label hold the model name as provided by the provider, and is output only in the models UI."*; and on capabilities: *"it's not like the user can all of a sudden decide that the model can juggle, do NOT display a fucking text input field for that, I haven't even decided yet what goes on the model row for capabilites"*. Andy: *"ALL, drop the description for ALL tables. it does NOTHING AND IS USELESS."*, *"ALL, from all agent-tables I mean..."*. The model table has no model name and no description column; its label holds the model name exactly as the provider gives it, and its search answers the id, the label and the provider's icon. Its detail shows the label, the provider and the capabilities, none of them editable.

## What its test must try to break

- A model naming a provider that is not there, by add or by set.
- Capabilities that come back as text instead of a list.
- A model shown without its provider's icon, or the icon kept in the table.
- A list showing the label where the model name belongs; a provider models button still handed, the Update model list pane still there, an Ask that shows a list or asks with no provider chosen; an Add button.
- A model's provider drawn as a picker or an input.
- A model name column, a label taken from the provider's display name, or a label, provider or capabilities drawn as an input.
