# persona/

`spirit/run/process/js/agent/table/persona/` is the persona table (goal/G41.4). Its test is `./persona.js`. What every
table shares is specified in `../../test/`.

Andy, box v22: *"a persona table. keyed by ID same as the shadow-roll (with Label and Description, and a
codeMirror-field for the persona-description i give it with every prompt)"*.

## Requirements

- It has `server.js`, `elementTable.js` and `elementRow.js`.
- `server.js(ctx)` makes the `persona` table on `ctx.db` with the shared rowTable. Its columns are the key set, the
  icon, label and description, then `persona`, and nothing else.
- `persona` is its text, kept as typed, lines and all. A set of another field keeps it.
- A persona deleted takes no grants: grants are a job's.
- **A search answers the id, the icon and the label of a row, nothing else** (goal/G41.18; Andy: *"only the ID and
  the fields shown in a table, that's all it needs."*): what its list shows. The editor reads the rest by get.
- `elementTable.js` registers `spirit.elements.personaTable.create(container, api, detail)`:
  - It requires the shared element and its own `elementRow.js`.
  - It builds on `agentTable` for the persona table, with the shared Add.
  - A row it opens is a `personaRow`.
- `elementRow.js` registers `spirit.elements.personaRow.create(container, api, id, added, detail)`:
  - It builds on `agentRow` with the persona table's look.
  - Its fields are the label, the description, and the persona in a CodeMirror editor.

- **elementRow.js takes the persona table's rows from the stream itself** (goal/G41.16; Andy: *"get rid of thos FUCKING data.js
  scripts"*): its page files require no data script; a row of the agent stream (`{ agent: { table: 'persona', row } }`,
  module `process/js/agent`) lands at `agent.persona/<id>` and the branch's watcher hears it; a changed row is merged; one
  removed, by its id, is gone; another table's rows, another module's, and a row with no id write nothing.

## Requirements (goal/G41.21, box v19)

- **The persona table gains a field, bundle**: the key of one of the node's bundles (Andy: *"and where the fuck is my
  bundle field in persona-table and the fucking picker for a bundle with the persona?"*). A persona keeps it, its text
  as it was; nine columns, nothing else.
- **Its detail panel sets it with the bundle selector in dropdown mode** (kind `bundle`), after the persona's text, as
  the job's does.

### No invalid persona row (goal/G41.21, box v23)

Andy: *"NO FUKCING INVALID ROWS GET ONTO A TABLE!!!!!!!!!!!!!"*, *"for a new row, a valid label (NOT empty) IS THE MINIMUM required"*, *"# mandatory fields (server AND ui)"*. The persona table's mandatory fields are its icon and label: an add without one, or with a label of blanks, is refused and makes
no row, naming the field; a change that would empty one is refused, the row kept. The row element hands the shared
editor the same fields (`required`), so the UI checks them too.

### No description (goal/G41.21)

Andy: *"ALL, drop the description for ALL tables. it does NOTHING AND IS USELESS."*, *"ALL, from all agent-tables I mean..."*. The persona table has no description column, and its detail no Description field.

### Its provider (goal/G41.26)

Andy, box: *"agent.persona gains a provider field, it's detail provides the same provider-FUCKING-Selector in drop down
mode, that the job detail panel provides for the agent.job.provider"*.

- The persona table gains a column, `provider`, the key of a provider row; a persona keeps it, its bundle and text as
  they were. The agent family declares the persona's `provider` as it declares the job's.
- Its detail sets it with the providerSelector in dropdown mode, the job's own field (`{ field: 'provider', kind:
  'pick', pick: 'provider' }`), after the bundle. It is not mandatory, as the job's is not.

## What its test must try to break

- A persona text that loses its lines, or is emptied by a set of its label.
- The persona edited in a one-line field.
- A persona without its bundle column, or a detail with no bundle selector.
- A persona row added without its icon and label.
- A description column or field on the persona.
- A persona without its provider column, or a detail whose provider field is not the job's providerSelector:dropdown.
