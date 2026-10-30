# provider/

`spirit/run/process/js/agent/table/provider/` is the provider table (goal/G41.4): a model provider, its url and its API
key. Its test is `./provider.js`. What every table shares is specified in `../../test/`.

Andy, box v22: *"a provider table. keyed by ID same as the shadow-roll (with Label and Description, URL, and API_KEY
which will never reach the browser or any place outside of the agent process except the model providers API)"*.

## Requirements

- It has `server.js`, `elementTable.js` and `elementRow.js`.
- `server.js(ctx)` makes the `provider` table on `ctx.db` with the shared rowTable. Its columns are the key set, the
  icon, label and description, then `url`, `apiKey` and `unusable` (goal/G41.18), and nothing else.
- `apiKey` is secret:
  - it is kept on the row;
  - no get, search or published row carries it, only `apiKeySet`.
- A `url` that is not one is refused.
- **One provider row per url** (goal/G41.18; Andy, box v17: *"a new provider row will not be added if the URL is the
  same as an existing URL in the provider table, nor will a change be allowed if the change would result in duplicate
  URL's, trailing slashes don't count as different."*):
  - an add with a url already in the table, or the same url with a trailing slash, is refused `bad-request` and adds
    nothing;
  - a set to another row's url is refused, the url kept;
  - a row may keep its own url, with or without the slash, and change its other fields;
  - rows with no url are no duplicates of each other.
- **ask** (goal/G41.18; Andy, box v17: *"the provider table gets a new verb: \"ask\", which does the model-list fetching
  and model-table updating"*). It is an op of the provider verb, `provider { op: 'ask', id }`, beside add, set, delete,
  get and search:
  - A row that is not there is refused `no-such-row`.
  - **The plugin is the row's label**, matched in any case (*"<providerName> must match the label of a provider row"*,
    *"case-insensitive"*): `process/js/agent/provider/<name>/<name>.js`, its `models({ url, apiKey })`. A row labelled
    Anthropic or ANTHROPIC asks through the Anthropic plugin, with its key.
  - **A row no plugin matches asks through the OpenAI plugin** (Unsloth, the box's test case), `GET <url>/models`.
  - It answers `{ models: [{ modelName, label }], updated }`, the provider's list as the plugin gave it.
  - **When the list has models, the model table is updated, for that provider alone** (*"Updated means, unavailable
    models from that provider will be removed, also"*):
    - a model not yet in the table is added, with the provider's id, the model name, and the provider's name of it as
      label;
    - a model the provider no longer lists is removed;
    - a model it still lists keeps its row, with the label and description as he set them;
    - another provider's models are not touched;
    - every row added or removed is published, so the lists follow.
    - The answer says `updated: true`.
  - **An empty list changes nothing** (*"only if a provider answers with a list of more than 0 models"*): it answers
    `{ models: [], updated: false }`.
  - **A provider that fails is refused, and its row is flagged unusable** (*"if it fails, the provider row will be
    flagged as unusable"*): the `unusable` column, a bool, kept on the row and shown by get and the stream. A failed ask
    removes no model. An ask answered again clears the flag. The box names the OpenAI plugin failing, and that is the
    failure the test makes.
  - No answer of ask, and no row it publishes, carries the API key.
- **A search answers the id, the icon and the label of a row, nothing else** (goal/G41.18; Andy: *"only the ID and
  the fields shown in a table, that's all it needs."*): what its list shows. The editor reads the rest by get.
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

## Requirements (goal/G41.21, box v17)

- **The provider table gains a field, model**: the id of one row of the model table, the provider's current model.
  Eleven columns, nothing else.
- **Its detail panel gets a Model field at the bottom**: a pick field of the model table, `of: 'providerId'`, so it
  offers only the models whose provider is this provider (../../test/tableElement.md).

## What its test must try to break

- The API key in any answer or published row, ask's included.
- The API key shown as a plain text field in the editor.
- Two rows with one url, a trailing slash aside.
- ask through the wrong plugin, or with a label matched only in its own case.
- ask removing another provider's models, or his label and description of a model kept.
- An empty or failed list that changes the model table; a failure that leaves the row unflagged.
- No model column; a Model field that is not last, not a pick of the model table, or not narrowed to the provider.
