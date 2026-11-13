# spirit/relayDump.js — its own test

What a relay holds, asked over SSH, read-only (cycle 3: `cat routingTable.json` answers nothing since relay.db). Owed
since the rule *"every production script has its own test"* (goal/G47.1, box v72). A relay.db is made on a scratch root
with this tree's relayStore.js, owner.json beside it, and `run(rootDir, args, out)` is called in process.

- No verb: the counts, members and invites, exit 0.
- `key <publicKey>`: the member as JSON; an unknown key says so, exit 1.
- `label <label>`: never a whole-roll print, at most 10 holders and "(first 10 shown)"; the owner marked by owner.json's
  one key, not by a row; nobody holding it says so, exit 1.
- No invite token is printed by any verb.
- An unknown verb or a missing argument says the usage, exit 1.
- No relay.db: says so, exit 1, and creates none; the dump leaves relay.db byte for byte as it was.

## What its test must try to break

A label lookup that prints the whole roll; the owner read from a row; a token on screen; a dump that writes, or creates
a database where there was none.
