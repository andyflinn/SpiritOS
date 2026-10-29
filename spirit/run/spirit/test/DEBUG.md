# spirit/DEBUG.js

The DEBUG test routes, for node and relay alike (goal/G41.19). While a server's DEBUG is on, `DEBUG.js` gets the first
shot at every request, and answers its own addresses with what a test needs: a bare page mounting one module, or the
worst arguments a server's api could be sent. Its test is `./DEBUG.js`.

Andy, on G41.19:

- *"in DEBUG mode spirit/serverCommon.js does the following: it activates the following, dynamic path system"*
- *"a module repo:/spirit/run/spirit/DEBUG.js that serveCommon.js \"requires\"?"*
- *"DEBUG.js gets only loop-back requests, and none with non-loopback headers."*
- *"i want to specify that wsl's element mount tests must be the first user of this DEBUG feature."*

## Requirements

### Its files

- `spirit/run/spirit/DEBUG.js`, required by `serveCommon.js`.
- One generator script per kind of answer, in `spirit/run/spirit/DEBUG/`: `headLessBrowser.js` and
  `garbageArguments.js`. `DEBUG.js` only reads the address and hands it to that script.
- `spirit/run/shell/mount.html` is gone: the page is made from the address.
- A module's special needs for a generator sit beside its tests: `<folder>/test/<module>-<generatorScript>.json`. The
  grants panel's is `shell/js/test/grantsPanel-headLessBrowser.json`, and its old name,
  `grantsPanel-boot-sibling-generalRules.json`, is gone.
- Neither `DEBUG.js` nor its `DEBUG/` folder can be fetched by a browser, DEBUG on or off.

### The address

`/DEBUG/<path>/<module>/<generatorScript>.<ext>`: the folders between `spirit/run/` and the module, exactly as they are;
the module's name without extension; the generator script's name without `.js`, the extension being the reply's type
(`.html` a page, `.json` data). For example `/DEBUG/shell/js/workBench/headLessBrowser.html`.

### DEBUG off

- The address is never asked of `DEBUG.js`, and answers exactly what any address of no route answers: the same status
  and the same body as the same address under another first folder.

### DEBUG on: what it answers

- **headLessBrowser**, a page: status 200, an HTML type. The most minimal page:
  - no comments;
  - one script tag that loads a file, and it loads `/spirit.js`, before any other script;
  - it names the module it mounts (its run path), and mounts that one module alone.
  - What the page does when it runs is judged by the first user, the shell's general rules
    (`spirit/run/shell/test/boot-sibling-generalRules.md`).
- **garbageArguments**, data: status 200, a JSON type, a list. Each entry is a body for the api door as it is, made
  from the verbs and argument shapes the server's api answers. For a module whose api the node serves (the file server,
  `/DEBUG/process/js/fileServer/fileServer/garbageArguments.json`):
  - at least one entry for every verb of that module's api;
  - every entry thrown at the node's api door (`POST /api/spirit`) is answered with a refusal that carries a code:
    a 4xx status and a `code`, never a 2xx, a 5xx or a "handler failed";
  - the node still answers its api afterwards.

### DEBUG on: what it refuses

Each is not answered by DEBUG.js, so it answers as an address of no route does (a 4xx), never a page or a list:

- no such module under `spirit/run`;
- a `..` anywhere in the address (sent as it is, not normalised by the client);
- no such generator script;
- a request carrying a forwarded-from header (`X-Forwarded-For`, `Forwarded`): Caddy passes a request from the internet
  to a relay from loopback, saying where it came from;
- a request not from loopback: tried on the relay, which listens on every address, by asking it at this machine's own
  non-loopback address. (The node listens on loopback alone, so nothing else can reach it.)

### Node and relay alike

The same answers and refusals on a relay with DEBUG on: its login app's page
(`/DEBUG/shell/login/login/headLessBrowser.html`), its own api's garbage (`/DEBUG/spirit/relay/garbageArguments.json`,
a JSON list), the forwarded-from header and a non-loopback request refused. With DEBUG off the relay answers the
address as no route.

## Its test names

Every section starts with the address it asks, `/DEBUG` left off, or the file it reads (Andy: *"please start the test
descriptions always with the exact URL to the server, without \"/DEBUG\" service"*; box v13: *"EVERY MOTHERFUCKING
TEST NAME in the product three STARTS WITH THE MUTHERCUCKING PATH"*): `/shell/js/workBench/headLessBrowser.html, the
node, DEBUG on`.

## How it is tried

A scratch copy of the tracked files of `spirit/run`, on servers of their own, on free ports: some verbs change or
delete things, so neither Andy's node nor an agent's is touched.

- The node: `spirit/server.js`, its DEBUG switched by its own verb, `node.debug { debug: { on } }`.
- The relay: `spirit/relayServer.js`, in a process whose spirit object is switched on before the relay loads
  (`spirit.debug(true)`): the relay's DEBUG verb is the owner's, by a signed packet, and a scratch relay has no owner.
  A second relay, not switched, is the DEBUG-off case.

## Owed, not asserted here

- Throwing the relay's garbage at the relay's own door: its api is reached by a member's signed packet, not a plain
  post, so the throw needs a member of the scratch relay. Its shape is not settled.

## What its test must try to break

- A DEBUG address answered while DEBUG is off.
- A page with a comment, a second script file, or a script before `/spirit.js`.
- A `..`, a forwarded-from header, or a request from outside answered.
- A garbage entry that crashes a handler, answers 500, or is accepted.
- `DEBUG.js` or a generator fetched as a file.
