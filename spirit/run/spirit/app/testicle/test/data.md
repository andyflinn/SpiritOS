# spirit/app/testicle/data.js — its own test

What a client knows of testicle's server (goal/G41.28, goal/G47.1): its three tables, `script`, `suite` and `testicle`,
each a branch under the node that served it, and the monitor's one row. Owed since the rule *"every production script
has its own test"* (goal/G47.1, box v72). It runs in a window of its own beside the real `spirit/data.js`, the rows
handed in as the stream hands them; in node it is asked through `spirit.cacheManager('testicle')`.

- It stands at `spirit.data.testicle.data`; its `tables` are script, suite, testicle; `branch(table)` is
  `<node>/testicle/<table>`, `''` for any other.
- The translator (the box: *"the server, of course, publishes changes"*): a script row kept at `script/<name>`, a
  suite row at `suite/<key>` (or `script|suite`), a test row at `testicle/<key>` with `scriptName` and `suiteName`, the
  last part of each path (the box: *"show the file name only, no path"*); a row published again is merged. Another
  module's rows, another table's, a row with no key write nothing; another node's rows go under that node.
- Every suite, each once (the box: *"Every element of testicle's face updates itself in response to the server
  stream"*): a suite row with its script makes `suite/|<suite>`, script `''`; green when all its rows are, red and
  `still red` when any is, `needs running` when any is flagged, deleted only when all are.
- The monitor: `monitor.get()` is `{}` before anything; `busy` is what the stream last said; `last` is the last row
- `monitor.get().doing` is what the stream last said the server is doing (`classifying 120 of 253`, `running <suite> for <script>`, `` when idle).
  published, `{ table, key, change, at }`, change `updated` when not named; `monitor.watch(fn)` is told on every change
  and answers its release.
- The preferences (goal/G47.1, box v79, 4): `preferences.get()` is `{}` before anything, then what the stream last said, `{testicle: {preferences}}`, or what `preferences.keep(p)` kept; `preferences.watch(fn)` is told on every change and answers its release.
- `keep(table, rows)` merges a verb's answer into the table's branch, a test row with its names; a table it has not,
  rows that are no list, or rows with no key write nothing.
- `suite.watch`, `script.watch`, `testicle.watch` are each told `fn(key, row)` for their own table only, and answer
  their release.
- In node, `spirit.cacheManager('testicle')` loads it.

## What its test must try to break

A test row kept without its file names; every suite's row judged green while one of its rows is red, or deleted while
one still stands; the monitor's last change not following the stream; a table's watch told of another table.
