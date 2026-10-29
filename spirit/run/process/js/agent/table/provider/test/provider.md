# provider/

`spirit/run/process/js/agent/table/provider/` is the provider table (goal/G41.4): a model provider, its url and its API
key. Its test is `./provider.js`. What every table shares is specified in `../../test/`.

Andy, box v22: *"a provider table. keyed by ID same as the shadow-roll (with Label and Description, URL, and API_KEY
which will never reach the browser or any place outside of the agent process except the model providers API)"*.

## Requirements

- It has `server.js`, `elementTable.js` and `elementRow.js`.
- `server.js(ctx)` makes the `provider` table on `ctx.db` with the shared rowTable. Its columns are the key set, the
  icon, label and description, then `url` and `apiKey`, and nothing else.
- `apiKey` is secret:
  - it is kept on the row;
  - no get, search or published row carries it, only `apiKeySet`.
- A `url` that is not one is refused.
- `elementTable.js` registers `spirit.elements.providerTable.create(container, api, detail)`:
  - It requires the shared element and its own `elementRow.js`.
  - It builds on `agentTable` for the provider table, in its box, with the page's api and detail pane, and the shared
    Add.
  - Its refresh and destroy are the shared element's.
  - A row it opens is a `providerRow`.
- `elementRow.js` registers `spirit.elements.providerRow.create(container, api, id, added, detail)`:
  - It builds on `agentRow` with the row's id, added, and the provider table's look.
  - Its fields are the label (name), the description, the url, and the API key as a secret.

- **elementRow.js takes the provider table's rows from the stream itself** (goal/G41.16; Andy: *"get rid of thos FUCKING data.js
  scripts"*): its page files require no data script; a row of the agent stream (`{ agent: { table: 'provider', row } }`,
  module `process/js/agent`) lands at `agent.provider/<id>` and the branch's watcher hears it; a changed row is merged; one
  removed, by its id, is gone; another table's rows, another module's, and a row with no id write nothing.

## What its test must try to break

- The API key in any answer or published row.
- The API key shown as a plain text field in the editor.
