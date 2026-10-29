# grant/

`spirit/run/process/js/agent/table/grant/` is the grant table (goal/G41.4). Its test is `./grant.js`. The one interface
to a grant table is specified in `spirit/test/authTableInterface.md`, and what the tables' page elements share in
`../../test/`.

Andy, box v22: *"an grant/auth table, keyed by job-ID, structured exactly like the auth table in node"*, and why: *"the
jobs have their api requirements on the node. they are my ultimate target, agent-persona or underlying models may be
subject to whim and experimentation"*.

## Requirements

- It has `server.js`, and no page files of its own: `elementTable.js` and `elementRow.js` are gone (goal/G41.16). The agent
  app's grant tool is the grants panel (`shell/js/grantsPanel.js`), drawing the grants by job with the grant list and row
  of `shell/js/grantSelector/`.
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
- The row it publishes on an add carries the job's label, `job`, as its search answers it (goal/G41.16: the grants panel
  shows a grant by its job's label, straight from the stream).

## What its test must try to break

- A grant to a job that is not there.
- A job deleted whose grants stay.
- A grant shown without its job's label and icon.
- The old page files left beside the panel.
