# spirit/app/agent/data.js — its own test

What a client knows of the agent server's tables (goal/G41.28; Andy: *"We're not done until every family of the API
tree as a clientCacheManager"*): job, model, persona and provider, one branch each, id -> the row, under the node that
served it. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs in a window
of its own beside the real `spirit/data.js`, the rows handed in as the stream hands them; in node it is asked through
`spirit.cacheManager('agent')`.

- It stands at `spirit.data.agent.data`; its `tables` are job, model, persona, provider.
- The translator (goal/G41.16): a row published, `{ agent: { table, row } }`, is merged into `<node>/agent/<table>/<id>`
  under the node that served it, keeping the fields a later publish did not carry; `{ agent: { table, id, removed } }`
  takes it out. Another table's rows, another module's, a row with no id write nothing.
- `branch(table)` is `<node>/agent/<table>`, `''` for a table the server has not.
- `row(table, id)` answers the row, null for one not kept, no id, or another table.
- Each table is its own object with a `watch`, the branch implied by the object (Andy, goal/G43.32: *"a BRANCHE's what is
  called "watch""*): `watch(fn)` is told `fn(id, row)` on every change of that table and no other; `watch(id, fn)` is
  told `fn(row)` each time that row is written, undefined once it is gone; each answers its release. No id watches
  nothing.
- In node, `spirit.cacheManager('agent')` loads it.

## What its test must try to break

A publish that replaces a row instead of merging it; a removed row that stays; a row of another table, module or node
landing in the page's branches; a table's watch told of another table; a watch still told after its release.
