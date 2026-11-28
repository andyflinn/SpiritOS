# spirit/server/script.js

The launcher (goal/G48.5): it requires spirit.js, makes it available to all modules in spirit/server/, and starts one server
by its mode: --node (the default), --relay or --app. Its test: `./script.js`. The node's own tests are
`../node/test/script.js`.

## What its test judges

- With no mode and with --node, and --port, it starts a node on that port.
- A mode it does not know is refused: it exits with a code that is not 0 and serves nothing.
- A relay it starts with --relay, whose store cannot open, exits 78, for systemd (bash/systemd/spirit-relay.service).
- No tracked file names an old path: none of the three moved core files, none of the four node<Name>.js.
- No file stands at an old path.
- It hands its modes to spirit/server/node/script.js, relay.js and app.js.

Each start runs in a lab tree of its own, which it lets go once its check is done.

## One server (goal/G49.25, box v16)

spirit/server/script.js is the node and the relay; --app still goes to spirit/server/app/script.js. spirit/server/node/,
relay/ and serveCommon/ hold no script.js. Launched with --relay it sets spirit.IS_RELAY true in the statement right after its
require of spirit/script.js, and no other product script sets it true. Required by another script it starts nothing (the
process ends by itself) and hands out every helper serveCommon handed out at f3e398ecb. It requires spirit/fs/script.js and
mounts, by a written name, only spirit and spirit.fs. A scratch node with planted trunk branches serves spirit.zzLoaded (new
shape) and spirit.zzOld (old shape) unnamed, no spirit.relay although spirit/relay carries the mark, and never a branch's
server/ folder.

The relay branch at the one door (Andy: "ONE, SINGLE, MOTHERFUCKING DOOR"; "the whole \"owner\"-verb shit is useless"):
spirit/relay/script.js hands out its verbs, its node work in spirit/relay/server/script.js; no product script serves or calls
a route under /spirit/relay/; none names OWNER_VERBS. The member verbs passing the grant gate on a relay is asserted once the
box names them.

Box v20: no product script serves or calls /face/call, /face/file, /face/stream or /face/api; the server still answers
Caddy at GET /face/allowed; the relay branch hands out exactly the 24 verbs of box v24 (Q13); no
product script names MEMBER_VERBS. The member bundle at join and leave is asserted once the relay runs at the one door.
