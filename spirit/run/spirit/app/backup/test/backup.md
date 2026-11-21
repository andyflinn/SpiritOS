# spirit/app/backup/backup.js

The script the node starts for backup (goal/G48.5): it takes spirit.js first and loads its server, `./server/server.js`, on the
node, and nothing else. Its test: `./backup.js`. The server's own tests: `../server/test/server.js`.

## What its test judges

- It is there and takes spirit.js first.
- What it loads is its server, spirit/app/backup/server/server.js, and nothing else.
- On a scratch node with backup switched on, the server it loads answers its DEBUG verb.
