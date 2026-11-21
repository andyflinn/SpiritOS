# spirit/app/testicle/testicle.js

The script the node starts for testicle (goal/G48.5): it takes spirit.js first and loads its server, `./server/server.js`, on the
node, and nothing else. Its test: `./testicle.js`. The server's own tests: `../server/test/server.js`.

## What its test judges

- It is there and takes spirit.js first.
- What it loads is its server, spirit/app/testicle/server/server.js, and nothing else.
- On a scratch node with testicle switched on, the server it loads answers its DEBUG verb.
