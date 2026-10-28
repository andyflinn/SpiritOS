# data.js

`spirit/run/process/js/agent/table/data.js` is the agent tables' translator (goal/G41.4). It says what the agent
server's stream means for spirit.data (`shell/js/spiritData.js`), the way `shell/js/contacts/data.js` and
`shell/shared/js/deskData.js` say it for theirs. Its test is `./data.js`.

Andy, on G41.4: *"make sure that all element LISTEN to what needs listening to, by themselves, automatically. This
should also be a general implementation."* So nothing in a table's page listens by hand. Each table is a branch of
spirit.data, and the stream keeps it current through this file.

## Requirements

- It registers with spirit.data's `translate`, and does nothing on a page without spirit.data.
- It registers `spirit.agentData { branchOf, keyOf, published }`:
  - `branchOf(table)` is `agent.<table>`;
  - `keyOf(table, row)` is the row's `id`, or a grant's `<job_id>|<path>`.
- It reads only jobs of module `process/js/agent` whose `app.agent` is a table's row. The rowTable and grant/server.js
  publish them.
- A row added or changed, `{ table, row }`, is merged at `agent.<table>/<key>`:
  - what it names changes, and what it does not name stays;
  - a grant keeps the job's label a search seated.
- A row gone is deleted from its branch: `{ table, id, removed }`, or a grant's `{ table: 'grant', row, removed }`.
- Every event ends in set or del. It asks nothing and keeps nothing of its own, so the branch's watchers, every list
  and editor of the table, redraw by themselves.
- It writes nothing for:
  - another module's job;
  - the debug state;
  - a row with no table, no row, or no key;
  - a grant missing its job_id or its path.

## What its test must try to break

- A changed row that loses the fields it did not name, such as a provider's `apiKeySet` or a grant's job label.
- A delete that leaves the row, or takes another with it.
- A grant keyed by a missing half (`undefined|undefined`).
- Another module's job, or the debug state, written into a table's branch.
