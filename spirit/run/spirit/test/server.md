# spirit/server.js

The launcher (goal/G48.5): it requires spirit.js, makes it available to all modules in spirit/server/, and starts one server
by its mode: --node (the default), --relay or --app. Its test: `./server.js`. The node's own tests are
`../server/test/node.js`.

## What its test judges

- With no mode and with --node, and --port, it starts a node on that port.
- A mode it does not know is refused: it exits with a code that is not 0 and serves nothing.
- A relay it starts with --relay, whose store cannot open, exits 78, for systemd (bash/systemd/spirit-relay.service).
- No tracked file names an old path: none of the three moved core files, none of the four node<Name>.js.
- No file stands at an old path.
- It hands its modes to spirit/server/node.js, relay.js and app.js.

Each start runs in a lab tree of its own, which it lets go once its check is done.
