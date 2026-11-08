# The backup server copies the node's state

goal/G43.23, item 5. Its test is `./backup-copies.js`: the tree's own `backup.js`, started as the node starts it (`--state spirit/state/backup/data`, `--node`), on a scratch tree under /tmp with HOME in the scratch; no node runs.

The box: *"backup copies nothing: it copies only its own state folder and reads a config path that does not exist"*.

## Requirements

- A file of another process's state, `spirit/state/desk/data/marker.json`, is copied into the backup.
- The node's `spirit/state/node.db` is copied into the backup, its rows readable in the copy.
- The backup lands under the `spiritHome` that `spirit/state/config.json` names, and nothing under the fallback `<home>/.SpiritOS`.
