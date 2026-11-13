# spirit/app/backup/data.js — its own test

What a client knows of the backup (goal/G41.28; Andy: *"anything not using the new spiritData.js and it's buddies
clientCacheManager.js must do so in this item. no exceptions."*): the backup server's status as `status.get` last
answered it, kept in the page's `spirit.data` under the node that served it. Owed since the rule *"every production
script has its own test"* (goal/G47.1, box v72). It runs in a window of its own beside the real `spirit/data.js`; in
node it is asked through `spirit.cacheManager('backup')`.

- It stands at `spirit.data.backup.data`, with `keep`, `status`, `watch` and `branch`.
- `status()` is null before anything is kept.
- `branch` is `<node>/backup/backupStatus`, the branch this file alone names.
- `keep(status)` keeps the answer at `<branch>/now`, and `status()` answers it; a refusal (`ok: false`) or nothing lets
  it go, `status()` null again.
- `watch(fn)` is told the status on every change, null when it goes; it answers its release, after which it is told
  nothing.
- It translates nothing: a backup job on the stream writes nothing (*"The server publishes no row of its own"*).
- In node, `spirit.cacheManager('backup')` loads it and it stands at `spirit.data.backup.data`.

## What its test must try to break

A refusal kept as if it were a status; a watch that is not told when the status goes, or still told after its release;
a translator that keeps a job's rows; the branch moved off the serving node.
