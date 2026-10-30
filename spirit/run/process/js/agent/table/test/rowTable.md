# rowTable.js

`spirit/run/process/js/agent/table/rowTable.js` is one keyed table of `agent.db` and its one verb (goal/G41.4). It holds
what the provider, model, persona and job tables share. Each table's `server.js` names its own fields and nothing else.
Its test is `./rowTable.js`.

## Requirements

- `rowTable(db, def, publish)` answers `{ verb, has, label, icon }`.
  - `def` is `{ name, fields: { field: rule }, secret: [field], check(args, db), deleted(id) }`, each rule one of
    spirit.js's.
- The table is named `def.name`. It has `id`, the one primary key, then `privateKey`, `sealPublicKey` and
  `sealPrivateKey`. Every table also has the common fields `icon`, `label` and `description`, then the fields `def`
  names. A bool is kept as an INTEGER and a list as JSON text.
- Every row is keyed as the shadow roll keys a peer (Andy, box v22: "keyed by ID same as the shadow-roll"; "the ID-key
  for each row of these tables is generated at \"add-row\", including the rest of the key-set stored on that table
  row"):
  - add makes a whole identity with `spirit/relayAuth.js` `generateIdentity`.
  - Its public key is the row's `id`.
  - Its private key, seal public key and seal private key sit on the row.
- The secrets never leave the table (Andy: an API_KEY "will never reach the browser or any place outside of the agent
  process except the model providers API"; "The private halves of that set stay in the agent process"):
  - No answer and no published row carries `privateKey`, `sealPrivateKey` or a field `def.secret` names.
  - In place of each secret, a row says `<field>Set`, true or false.
- The verb is flat: `{ op, ...fields }`.
  - `add {fields}` answers `{ id }` alone.
  - `set {id, fields}` changes what it names and keeps the rest; it answers `{ id }`.
  - `delete {id}` removes the row, tells `def.deleted(id)`, and answers `{ id }`.
  - `get {id}` answers the row: bools as bools, lists as lists, no secret.
  - `search {text}` answers `{ items, more }`, one answer at most. Each item is `{ key: id, label: JSON }`, ranked
    best first. With no words it answers every row that fits.
  - **A search answers only what a list shows** (goal/G41.18; Andy: *"only the ID and the fields shown in a table,
    that's all it needs."*, and *"that exactly what GET is for, to bring in the rest for detail panels etc..."*): the
    label is the id and the fields the table names in `def.shows`, by default `icon` and `label`. It still ranks by
    every text field, so a word of a field it does not answer finds its row. `get` answers the whole row.
- Every change is published:
  - add and set publish `{ agent: { table, row } }`, the row as get shows it;
  - delete publishes `{ agent: { table, id, removed: true } }`.
- A refusal says why, in its `extra.why`:
  - an op it does not know is refused `bad-request`, naming the ops;
  - an argument it does not declare is refused `no-such-argument`, naming it;
  - `def.check`'s words are refused `bad-request`;
  - a row that is not there is refused `no-such-row`.
  - A refused add writes no row.
- `has(id)`, `label(id)` and `icon(id)` say whether the row is there, and give its label and its icon, `''` when it is
  not there.
- A table made before a field was gets the field at start, empty, and its rows are kept: the icon came after the first
  tables.
- The rows persist in `agent.db`.

## Requirements (goal/G41.21, box v17)

- **A search narrowed by a field**: a search naming one of the table's own fields (`{ op: 'search', text, providerId }`)
  answers only the rows whose field holds that value, ranked by the words as before; a value no row holds answers no
  rows; a search naming no field answers every row.

### Mandatory fields (goal/G41.21, box v23)

Andy: *"NO FUKCING INVALID ROWS GET ONTO A TABLE!!!!!!!!!!!!!"*, *"for a new row, a valid label (NOT empty) IS THE MINIMUM required"*, *"# mandatory fields (server AND ui)"*. A table names its mandatory fields (`def.required`): an add missing one, or holding one of blanks, is refused
and makes no row, the refusal naming every one missing; a change that would empty one is refused, the row kept; a
change keeping them all is taken. A table naming none takes a bare row, as before.

### No description (goal/G41.21)

Andy: *"ALL, drop the description for ALL tables. it does NOTHING AND IS USELESS."*, *"ALL, from all agent-tables I mean..."*. The common fields are the key set, the icon and the label; a table with a description column from before loses it at start, its rows kept.

## What its test must try to break

- A private half, a seal private key or a secret in a get, a search or a published row.
- A set that empties the fields it did not name.
- An add refused, by the table's check or a stray argument, that writes a row anyway.
- An argument it does not declare taken in silence. The face's calls once carried `verb` ("Not added: job takes no
  argument verb").
- An old table that loses its rows, or never gets the new field.
- A narrowed search answering another row's rows, or refusing the field.
- A row made, or emptied, without a mandatory field; a refusal that does not name it.
- A description column made, or kept from before.
