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
- `elementTable.js` registers `spirit.elements.jobTable.create(container, api, detail)`:
  - It requires the shared element and its own `elementRow.js`.
  - It builds on `agentTable` for the job table, with the shared Add.
  - A row it opens is a `jobRow`.
- `elementRow.js` registers `spirit.elements.jobRow.create(container, api, id, added, detail)`:
  - It builds on `agentRow` with the job table's look.
  - Its fields are the label, the description, the loop flag as a checkbox, and the job in a CodeMirror editor.

## What its test must try to break

- A job deleted whose grants stay.
- A grant dropped by an add or a set.
- A loop flag that comes back as a number.
