# model/

`spirit/run/process/js/agent/table/model/` is the model table (goal/G41.4): one model of one provider. Its test is
`./model.js`. What every table shares is specified in `../../test/`.

Andy, box v22: *"a model table, keyed by ID same as the shadow-roll (with Label and Description, provider-key, and
model-name and capabilities)"*.

## Requirements

- It has `server.js`, `elementTable.js` and `elementRow.js`.
- `server.js(ctx)` makes the `model` table on `ctx.db` with the shared rowTable. Its columns are the key set, the icon,
  label and description, then `providerId`, `modelName` and `capabilities`, and nothing else.
- `providerId` is a provider row's id. An add or a set naming a provider that is not there is refused, saying so, and
  the provider kept.
- `capabilities` is a list.
- `elementTable.js` registers `spirit.elements.modelTable.create(container, api, detail)`:
  - It requires the shared element and its own `elementRow.js`.
  - It builds on `agentTable` for the model table, with the page's api and detail pane, and the shared Add.
  - A row it opens is a `modelRow`.
- `elementRow.js` registers `spirit.elements.modelRow.create(container, api, id, added, detail)`:
  - It builds on `agentRow` with the model table's look.
  - Its fields are the label, the description, the provider, the model name, and the capabilities as a list.
  - The provider is picked from a search of the provider table.

- **elementRow.js takes the model table's rows from the stream itself** (goal/G41.16; Andy: *"get rid of thos FUCKING data.js
  scripts"*): its page files require no data script; a row of the agent stream (`{ agent: { table: 'model', row } }`,
  module `process/js/agent`) lands at `agent.model/<id>` and the branch's watcher hears it; a changed row is merged; one
  removed, by its id, is gone; another table's rows, another module's, and a row with no id write nothing.

## What its test must try to break

- A model naming a provider that is not there, by add or by set.
- Capabilities that come back as text instead of a list.
