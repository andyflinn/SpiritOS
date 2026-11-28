# spirit/server/script.js

The one server (goal/G49.25, box v16): the launcher (goal/G48.5), which requires spirit.js and starts one server by its
mode, --node (the default), --relay or --app; the helpers it hands out when required (serveCommon's until goal/G49.25);
and the node it starts. Its test, all of it: `./script.js` (one test file per module: the tests of
spirit/server/serveCommon/script.js and spirit/server/node/script.js folded in here when their code did).

## What its test judges

- With no mode and with --node, and --port, it starts a node on that port.
- A mode it does not know is refused: it exits with a code that is not 0 and serves nothing.
- A relay it starts with --relay, whose store cannot open, exits 78, for systemd (bash/systemd/spirit-relay.service).
- No tracked file names an old path: none of the three moved core files, none of the four node<Name>.js.
- No file stands at an old path.
- It hands --app to spirit/server/app/script.js, and requires neither spirit/server/node/ nor spirit/server/relay/.

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
Caddy at GET /face/allowed; the relay branch hands out exactly the 25 verbs of box v24 (Q13), faceFile gone, join and joinConfirm in (Q17); no
product script names MEMBER_VERBS. The member bundle at join and leave is asserted once the relay runs at the one door.

The presence moves: spirit/presence/script.js to spirit/relay/presence/script.js, spirit/presenceNode/script.js to spirit/contact/nodePresence/script.js; nothing at the old paths, no product script requires them.

## The helpers it hands out (serveCommon's until goal/G49.25)

Required, spirit/server/script.js starts nothing and hands these out; they are judged in process, from it.

What the node and the relay both answer HTTP with (cycle 0, NODE-AND-RELAY.md): reading a body, sending a file,
refusing too big or malformed, saying which build this is, and the first-run defaults. Owed since the rule *"every
production script has its own test"* (goal/G47.1, box v72). In process: a planted res, request stream, server and
socket, a scratch home for what it writes, and process.exit planted where it would stop the process.

- `portFromArgs`, `emailFromArgs`: `--port <n>`/`--port=<n>`, `--email <a>`/`--email=<a>` (goal/G30.2); null and `''`
  without the flag.
- `verifyStartupCwd`: refuses, exit 1 and a sentence naming the entry, from a folder that is not spirit/run or lacking
  a folder the entry names; a start from spirit/run with only `spirit/` goes on (goal/G16.9).
- `refuseListenError`: a port in use stops the process naming the port and the next one; any other error stops it too.
- `sendFile`: 200 with the type by extension; 404 for no file and for a path with a NUL, never a crash (goal/G41.30).
- `readBody` (goal/G16.6): a character split across chunks arrives whole; past `max` refused at once, 413
  `body-too-large`, the stream destroyed; a caller's own `code` and `message`; `onBytes` hears the running total.
- `readJsonBody`, `bodyBytes`, `useBody`: parsed, `{}` for empty, bad JSON rejects; one promise per request; a declared
  length past `BODY_MAX` refused before reading, and a chunked one by the running total, 413 and the socket destroyed;
  `bodyBytes` 0 before, the count after; what `useBody` sets is the body later readers get (goal/G41.15).
- `refuseTooBig`, `nodeRefusal`, `parseRequestPath`, `answerClientErrors`: 413 and true past `BODY_MAX`; "not now" with
  `node-not-now`, the status varying and the string never; 400 and null for `/%zz`, `/%` and `/%00` (goal/G41.30); an
  unparseable request answered 400 in order, a reset only destroyed.
- `clientKeyFor` (goal/G22.7): from the loopback the last X-Forwarded-For entry; elsewhere the socket address.
- no `sendVersion`: the product hands out no build stamp (goal/G49.13).
- `firstDescription`, `ensureFirstRun` (goal/G30.7): to the second, UTC; written only into a blank; a relay named
  nothing or `relay` becomes `relay <hostname>`, a name of its own stays (rule/13).
- `writeEnvironment` (goal/G40.6): the port in spirit/state/environment.json, the folder made.
- no `pageFile` and no `PAGE_FILES` (goal/G49.13): every page file is asked and served at its own run path.
- `debugFirst` is DEBUG.js's `answer` (goal/G41.19).

### What its test must try to break

A body joined chunk by chunk (U+FFFD in a signed request); a refused body that goes on being read; a rate-limit key
taken from the first, sender-written X-Forwarded-For entry; a NUL or bad escape that kills the process; a restart that
overwrites a description somebody typed.

## The node it starts (spirit/server/node/script.js until goal/G49.25)

### Requirements (goal/G43.30)

Andy: *"can we delete run://shell/, run://spirit/shell/index.html, and make face.html the default for "/" ???"* The box: *"In spirit/server/script.js, the home page is face.html."*

- `GET /` answers 200, as `text/html`, with `spirit/shell/face.html` byte for byte, as it stands on the disc.
- Opened in a real Chrome, the page at `/` has the spirit object, `spirit.readyPromise` settles, and it loads face.html's own scripts.

### What it must try to break

- A `/` that still answers the old shell's page, or a page that only looks like the face.
- A `/` whose spirit object never settles.

### The attacker's garbage, at every door

Thrown at every door of a node (goal/G41.30), its section of `./script.js`. Andy, the box: *"all servers (node and relay, or
serveCommon) are tested by throwing malformed paths at them, and malformed, invalid arguments."*, *"all appServers are
systematically tested for dealing with bad arguments."*, *"an appserver api can be called outside a spirit object, and
an attacker trying to crash our servers will throw ANYTHING at the api. Imitate that attacker"*, and *"what counts as
passing: the server MUST not CRASH or HANG."*

#### How

- A scratch copy of `spirit/run` on a node of its own (`spirit/test/headLessChrome.js`), its app servers turned on at home, every one of the tree, each app folder whose `<name>.json` says `node.mount` true and holds its `<name>.js`, read from the folders and none named in the test (goal/G47.4)
  by a `face.home` sidecar each (desk, backup, chat; the file server, intrinsic, runs on every node).
  The list names agent too, but agent is an app of `spirit/app/` now, started by `active` in its `node.json`, which a
  sidecar does not set. Neither Andy's node nor an agent's is touched.
- **Introspect** (the box: *"introspect: each server's own api answer says its verbs and the shape of their
  arguments"*): the node's own api answer, every family and verb with its request shape.
- **Then throw garbage**, raw: over a bare socket, never through `spirit.js`, the request as written.
- It says up front how many asks it will make.

#### What it throws

- **Bad arguments, every verb** (the box: *"every argument is filled with every type JSON.parse can make: string,
  number, boolean, null, object, array"*, *"missing or superfluous arguments"*, *"every string argument is supplied in a
  few sizes, containing bad characters"*): each argument varied alone, the others as the verb's own example: every JSON
  type it is not; for a string argument, strings empty, of one byte, a null byte, a path that climbs, encoded climbs, a
  lone surrogate, control characters, markup, `__proto__`, and long ones up to 3/4 of the payload; the argument left
  out; one argument too many; and arguments that are no object at all.
  - **A verb that acts** (deletes, rotates, stops, sends, writes, runs; known by a word in its name) gets the whole
    garbage too, bad strings, missing and extraneous included, with its real handler (Andy, G41.30: *"A verb that acts
    (deletes, rotates, stops, sends) gets only garbage that breaks the shape ... never meets a bad string. - fill this
    gap"*), on a throwaway scratch node of its own, after the first node is judged and let go. Verb by verb, a plain call
    after each batch; a node that dies is judged against the verb that killed it and replaced by a fresh one.
- **Pairs, over the wire** (the box: *"Pairs, not every combination"*; Andy, G41.30: *"Pairs run against the gate in
  memory, not over the wire. - close this gap!"*): for every verb of two arguments or more, eight kinds an argument can
  be given (a bad string, the five other JSON types, left out, or kept with an extraneous argument beside it), and a set
  of asks in which, for any two of its arguments, every pair of their kinds appears at least once. Made greedily: 64
  asks for two or three arguments, about 124 for five, 153 for twelve.
- **Raw bodies at the node's door**: not JSON, JSON that is no object, a bare string, null, a body cut off half-way, one
  byte past `BODY_MAX`, a Content-Length far past what is sent, nesting 5000 deep, `__proto__` and `constructor` keys and
  calls, no Content-Type, a wrong one, invalid UTF-8, a request line that is not HTTP, a header line with no colon.
- **Malformed paths, GET and POST**: `..`, climbs encoded (`%2e%2e`, `%2f`), a 9000-character path, bad
  percent-encoding (`%`, `%zz`, a cut-off UTF-8 escape), double slashes, climbs into `spirit/state/` (node.json, identity.json) through
  the DEBUG, element and api routes, backslashes toward `relay-state`, `?%`, `#x`, `*`, and a null byte (`%00`), thrown
  last since it may kill the node.

#### What counts as passing

Per the box, *"the server MUST not CRASH or HANG"*:

- every ask is answered with a status within 10 s; never a 500, a 504, a 5xx that says nothing, or a handler that
  failed. A 502 or 503 that says why (a relay or a peer not reachable on a scratch node) is an answer;
- after every batch of 20 asks, and after every raw request, the node answers a plain call within 3 s;
- the node is still running at the end.

A body cut off, or shorter than it says, may be held by the node until its own time runs out; the node must still
answer everybody else. Each failing verb and each failing raw request is its own check, named by the door.

What it reports without judging (not a crash, so not red by the box's words): how many asks of garbage were answered
200 by each family (a lenient check), and the verbs that answer a bad argument 502 or 503 rather than 400.

#### Beside it

- **The relay's door** is spirit/relay/server/test/script.js's, on a scratch relay (spirit/test/headLessChrome.js,
  scratchRelay).
- **The shared gate in memory** (the box: *"Every permutation is thrown at that check directly, in memory"*) is
  `spirit/server/app/test/script.js`'s, not this file's.
- **A server not up judges nothing**: every server it turns on must be in the api answer, on the scratch node and on
  each throwaway node, or the run is red saying which.
- **The file routes hand out nothing outside what they serve** (goal/G47.6, box: *"the node's file routes refuse ../, also
  encoded"*): the climbing addresses above check only that the node answers and lives; one more check reads the answers:
  no climbing address, plain or encoded (`%2e%2e`, `%2f`, `%5c`), brings back the scratch node's identity.json, its node.json
  or the machine's passwd.

#### Reads the cache, never the disc (goal/G49.2)

The node's part of spirit/server/script.js, startNode() between its banners "THE NODE" and "THE RELAY", comments left out,
asks the disc for no file and lists no folder: no existsSync, no readdirSync (until goal/G49.25, spirit/server/node/script.js).

## The owner branch killed (goal/G49.24, box v18)

Gone: spirit/owner/, spirit/ownerPost/, spirit/puppetStream/, spirit/fuckingGarbage/boxes.js, none required by a product script;
no product script names peerOwnerPost, puppetDoor, ownerCommandIn or commandMessage. Gone too: spirit/puppetMode/ (Andy: "get rid of spirit.puppetMode, too."). Stays: relayAuth.loadOwner, which reads
who owns a node from owner.json.
