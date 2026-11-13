# spirit/job/data.js — its own test

What a client knows of a node's jobs (goal/G41.28): every job the stream hands over, kept as it came, and each job's last
events (goal/G29.14). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). It runs beside the real `spirit/data.js`; a job gone is handed to its translator's
`onDelete` as spirit.data hands it. The test reads through `spirit.data.job.data` alone.

- In node, `spirit.cacheManager('job')` finds it.
- Every job is kept as it came, without `fromNode`; kept again, the row is replaced.
- **The node's own jobs carry one kind of news per event** (goal/G43.20): a permanent job keeps the newest of each kind
  on its one row.
- **Its events**: a job's app object, kept once until it differs; for `spirit.fs` the tree command its change carries
  (goal/G4.25); for a permanent job its data. The last `eventWindow` are kept, the oldest falling off the top.
- A job with no id keeps nothing. A job the stream deletes goes, and its events with it.
- Reads: `job(id)`, `jobs()`, `events(id)`, `find(test)` (the first, or null), `watch(fn)`, `watch(id, fn)` (that
  one job; goal/G43.32), `branch` under the node that served it. Another node's jobs are filed under that node.

## What its test must try to break

- A permanent job's earlier news lost to a later kind; an event kept twice; the window grown or cut from the wrong end.
- A deleted job's events left; a watcher heard after its release.
