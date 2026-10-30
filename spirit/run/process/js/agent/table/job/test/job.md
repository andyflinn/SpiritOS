# job/

`spirit/run/process/js/agent/table/job/` is the job table (goal/G41.4). Its test is `./job.js`. What every table shares
is specified in `../../test/`.

Andy, box v22: *"a job table. keyed by ID same as the shadow-roll (with Label and Description, boolean loop-flag (not
for the model, for the agent-app), and a codeMirror-field for the job-description that may come with a prompt)"*.

## Requirements

- It has `server.js`, `elementTable.js` and `elementRow.js`.
- `server.js(ctx)` makes the `job` table on `ctx.db` with the shared rowTable. Its columns are the key set, the icon,
  label and description, then `loop` and `job`, and nothing else.
- `loop` is a bool, kept as an INTEGER. `job` is its text, kept as typed. A set of one keeps the other.
- A job's grants are keyed by its id (the grant table). So deleting a job asks the grant table to drop that job's
  grants, once. An add or a set drops nothing.
- **A search answers the id, the icon and the label of a row, nothing else** (goal/G41.18; Andy: *"only the ID and
  the fields shown in a table, that's all it needs."*): what its list shows. The editor reads the rest by get.
- `elementTable.js` registers `spirit.elements.jobTable.create(container, api, detail)`:
  - It requires the shared element and its own `elementRow.js`.
  - It builds on `agentTable` for the job table, with the shared Add.
  - A row it opens is a `jobRow`.
- `elementRow.js` registers `spirit.elements.jobRow.create(container, api, id, added, detail)`:
  - It builds on `agentRow` with the job table's look.
  - Its fields are the label, the description, the loop flag as a checkbox, and the job in a CodeMirror editor.

- **elementRow.js takes the job table's rows from the stream itself** (goal/G41.16; Andy: *"get rid of thos FUCKING data.js
  scripts"*): its page files require no data script; a row of the agent stream (`{ agent: { table: 'job', row } }`,
  module `process/js/agent`) lands at `agent.job/<id>` and the branch's watcher hears it; a changed row is merged; one
  removed, by its id, is gone; another table's rows, another module's, and a row with no id write nothing.

## Requirements (goal/G41.21, box v17)

- **The job table gains three fields**: `bundle` (the key of one of the node's bundles), `provider` (the id of a provider
  row) and `persona` (the id of a persona row); a job keeps them, its text as it was. Twelve columns, nothing else.
- **A job deleted asks no grant table**: the delete hook that dropped a job's grants goes with agent.grant (*"With it go
  ... the job's delete hook"*).
- **Its detail panel**: after the label, the description, the loop flag and the job, the bundle by the bundle selector in
  dropdown mode (kind `bundle`), the provider and the persona each by a pick field of its table.
- Enforcing the bundle when a job runs is out of scope (Andy: *"oos."*).

### No invalid job row (goal/G41.21, box v23)

Andy: *"NO FUKCING INVALID ROWS GET ONTO A TABLE!!!!!!!!!!!!!"*, *"for a new row, a valid label (NOT empty) IS THE MINIMUM required"*, *"# mandatory fields (server AND ui)"*. The job table's mandatory fields are its icon and label: an add without one, or with a label of blanks, is refused and makes
no row, naming the field; a change that would empty one is refused, the row kept. The row element hands the shared
editor the same fields (`required`), so the UI checks them too.

### No description (goal/G41.21)

Andy: *"ALL, drop the description for ALL tables. it does NOTHING AND IS USELESS."*, *"ALL, from all agent-tables I mean..."*. The job table has no description column, and its detail no Description field.

## What its test must try to break

- A job deleted whose grants stay.
- A grant dropped by an add or a set.
- A loop flag that comes back as a number.
- A job without its bundle, provider or persona; a delete that still asks a grant table.
- A job row added without its icon and label.
- A description column or field on the job.
