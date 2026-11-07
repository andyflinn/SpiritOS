# The Windows backup holds node.db and the keys

goal/G43.23, item 5. Its test is `spirit/test/backupWindows.js`: this tree's `install/backup-windows/backup.js`, copied into a scratch SpiritOS tree under /tmp shaped as a node keeps it now (node.db and identity.json in `spirit/run/spirit/state/`, `relay-state/` holding only `process/` and `shell/`), run as `run.cmd` runs it, with no `--from`; its sealed file opened with the passphrase and unpacked.

The box: *"the Windows backup misses node.db and the keys."*

## Requirements

- The backup holds the node's `node.db` of `spirit/run/spirit/state/`, its rows readable in the copy.
- The backup holds the keys, `identity.json` of `spirit/run/spirit/state/`.
