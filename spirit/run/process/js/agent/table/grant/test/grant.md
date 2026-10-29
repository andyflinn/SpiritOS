# grant/

`spirit/run/process/js/agent/table/grant/` is the grant table (goal/G41.4). Its test is `./grant.js`. The one interface
to a grant table is specified in `spirit/test/authTableInterface.md`, and what the tables' page elements share in
`../../test/`.

Andy, box v22: *"an grant/auth table, keyed by job-ID, structured exactly like the auth table in node"*, and why: *"the
jobs have their api requirements on the node. they are my ultimate target, agent-persona or underlying models may be
subject to whim and experimentation"*.

## Requirements

- It has `server.js`, `elementTable.js` and `elementRow.js`.
- `server.js(ctx)` opens the `grant` table of `ctx.dbFile` through `spirit/authTableInterface.js`. It answers
  `{ verb, dropJob }`.
- The table is `(job_id, path)`, both its primary key, and nothing else.
- The verb is flat, `grant { op, ... }`:
  - `add {job_id, path}` answers `{ job_id, path }` and publishes `{ agent: { table: 'grant', row } }`.
    - A grant to a job that is not there is refused `no-such-row`.
    - A grant with no path is refused.
    - An argument it does not declare is refused `no-such-argument`.
  - `get {job_id}` answers `{ job_id, paths }`.
  - `delete {job_id, path}` takes that grant away and keeps the others. It publishes the row removed. A grant that is
    not there is refused `no-such-row`.
  - `search {text}` answers `{ items, more }`:
    - each item is keyed `<job_id>|<path>`;
    - its row is `{ job_id, job, path, icon, label }`: the job's label and icon, and the label `job: path`;
    - a search matches the job and the words of the path.
  - There is no set: a grant is there or not.
- `dropJob(id)` takes every grant of that job away and publishes each one removed. The job table calls it when a job
  is deleted.
- `elementTable.js` registers `spirit.elements.grantTable.create(container, api, detail)`:
  - It builds on `agentTable` for the grant table.
  - A grant is matched by its job and the words of its path.
  - Its Add opens an empty editor and asks the server nothing: a grant is made from a job and a path.
  - A row it opens is a `grantRow`, handed the grant's row.
- `elementRow.js` registers `spirit.elements.grantRow.create(container, api, grant, detail)`. Its title row and field
  lines are every table editor's (`agentDetail`).
  - With no grant it is the Add form:
    - the title says Add;
    - the job is picked from a dropdown search of the job table, the one table search;
    - there is a path to type, and an Add button.
    - Add with no job, or no path, asks nothing and says what is missing.
    - Add calls `grant { op: 'add', job_id, path }`, the path trimmed. A refusal says the server's reason.
    - The grant added is shown from the server's answer.
  - A grant shown says Change, its job and its path, with nothing to type.
    - Delete calls `grant { op: 'delete', job_id, path }`. A refusal says the server's reason.
    - Once the delete is taken, it says `Deleted.` and is the Add form again.

- The row it publishes on an add carries the job's label, `job`, as its search answers it (goal/G41.16: the grants panel
  shows a grant by its job's label, straight from the stream).

## What its test must try to break

- A grant to a job that is not there.
- A job deleted whose grants stay.
- A grant shown without its job's label and icon.
- An Add sent with no job or no path.
