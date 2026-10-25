# spirit.js

`spirit/run/spirit.js`, the spirit object. Its red is `./spirit.js`, which asserts this document section by section.

## The rule

**spirit.js is the only JavaScript client interface to the SpiritOS core.** Every module and every page loads it
first and does everything through it. A module whose first require is not spirit.js goes red
(`./spirit-child-generalRules.js`).

## Its role

The one door. It is the only place that tells a page from node, it reaches the node by one post and one get, it puts
the node's families on itself, and it loads every other component. Everything is a client of the core and gets in
through this file, the node server and the relay server too, for the version, the MIME table, the debug switch and the
default port; they still take the body reader from `spirit/kernel.js` until it goes. spirit.js itself loads no kernel.

## One instance

There is one spirit object per JavaScript VM. On a page it is `window.spirit`; in node it is the only export of
spirit.js, and every module that requires it gets that same object. Before anything else, spirit.js sets the global;
a global spirit already there is the one it fills. Nothing makes a second object: there is no factory.

Every loaded or required module inserts its own api functions into that one instance: a node family's `api.js`, run
by spirit.js, becomes `spirit.<family>`.

## Where it runs

| | |
|---|---|
| `isNode()` | true when loaded by node |
| `isBrowser()` | true on a page: not node, and the global is `window` |
| `isLoopback()` | in a browser: true when the page's host is `127.0.0.1`, `localhost` or `[::1]`, its home node; false on any other host, a face reached through a relay, and in node |

Always in this order: spirit.js is loaded, it tells node from browser, in a browser it tells loopback from not, and
from that it decides what more to fetch. Through a relay, the face shell comes from the relay, and the seal from the
home node once the face is linked. No other line of spirit.js asks where it runs, and no other file is to ask.

## Its node

- **On a page**: the page's own origin, or the face's link to its home node when one is set (`window.spirit.transport`).
- **In node**: `127.0.0.1` and the `PORT` of `relay-state/environment.json` in the run root spirit.js sits in, read
  when spirit.js is required. The node's server writes that file through `serveCommon.writeEnvironment` before it
  starts any server process. No port, no node: calls refuse `no-node`, and no default port is guessed.

## One post and one get

Nothing else in spirit.js reaches the node.

| | |
|---|---|
| `post(verb, args, how)` | sends `{verb, ...args}` to the node's `/api/spirit`; answers `{status, text, body}`. With `how.stream` it answers the response itself, read as it comes (the events family's subscribe); `how.headers` are sent along |
| `get(path)` | fetches a file of the node's run root by its path; answers `{status, type, bytes}` |

Every member function checks its arguments and then calls one of the two.

## The node's families: `spirit.<family>.<verb>(args)`

- **args**: one plain object, its keys the arguments the family's `api.js` declares for that verb, each by its rule
  (below). Left out, it is `{}`.
- **Answers** a promise of the node's reply body.
- **Before it leaves**, every argument is checked: one the verb does not name refuses `no-such-argument`; a missing
  one, or one breaking its rule, `bad-request`. The node checks everything again.
- **A refusal from the node** rejects with its code, its own words (its error, else the first line of a plain-text
  answer) and its status.
- A dotted verb is also there in camel case (`line.write` as `lineWrite`). Each family has the names its own
  `api.js` adds, and the folder verbs `spirit.<family>.FS.<verb>`, for its own folder:

| FS verb | args |
|---|---|
| `loadFile`, `deleteFile`, `statFile`, `fileExists`, `loadJsonValue`, `getAnnotations` | `{ path }` |
| `saveFile` | `{ path, content }`, content a text |
| `saveJsonValue` | `{ path, value }`, value an object |
| `annotateFile` | `{ path, payload }`, payload an object |
| `search` | `{ q }`, q a text, optional |

A caller that holds a verb's name in a variable writes `spirit[family][verb](args)`. There is no `spirit.call`.

## The one loader: `spirit.require(path, key, how)`

The one async function that loads every other component, the same on a page and in node.

- **path**: a run-root path, '/'-separated; a leading '/' is dropped.
- **key**: left out or null for this VM's own node; a peer's public key for that peer's family (an interface path only).
- **how**: with a key, in node, handed to `spirit.peerPost` as its `how` (below).

| path | in node | on a page |
|---|---|---|
| a component | required from the run root, its `module.exports` | got by `get`, run, its `module.exports`; `not-found` when it is not there |
| an interface: `<name>/<name>.family/api.js` or `spirit/<name>/api.js` | binds `spirit.<name>` from its node and answers it, asked once by any number of callers at once; `no-interface` for a family the node lacks, `no-node` with no port | the same |
| an interface with `key` | the peer's family, through `spirit.peerPost` with `how`; held under the key, not on the instance | the peer's family, through the home node's `peer.post` |

## Its other members

### `peerPost(peer, app, body, how)`

Asks another node and waits for its answer.

- **peer**: the other node's public key, the ID it is reached by.
- **app**: what on that node takes the post. `'api'` is its spirit door, its families and their verbs; another word
  names one app on it.
- **body**: what is asked, a plain object. For `'api'`: `{ <family>: { <verb>: args } }`, or `{ api: { family } }`
  for a family's interface.
- **how**, all optional: `waitMs`, how long to wait for the answer (30 s by default); `patienceMs`, how long the node
  keeps retrying a busy relay; `kind: 'background'`, a post that may wait behind others. It always posts through this
  VM's own node.
- **Answers** the peer's answer body; `{ ok: false, code: 'not-posted' }` at once for a post the node refused;
  `{ ok: false, code: 'no-answer' }` after `waitMs` of silence. It resolves, never rejects.
- In node: one post of `peer.post`, and the answer read off the node's events (`events.subscribe`, a stream through
  `post`), as a server, so it is handed no backlog and marks nothing taken; on a page, the home node's `peer.post`.

### `check(name, spec, args)`

- **name**: the verb's full name, `'<family>.<verb>'`, used in the refusal's words.
- **spec**: the verb's declaration, `{ <argument>: '<rule>' }`; `'<rule>?'` makes the argument optional.
- **args**: the arguments, a plain object.
- **Answers** null when they pass, else the refusal (an Error with `code` and `argument`): `no-such-argument`, or
  `bad-request` for a missing argument, a broken rule, args that are no object, or a rule that does not exist.

### `rules`

The names of the rules a declaration may use:

| rule | passes |
|---|---|
| `text` | any string |
| `id` | a non-empty string |
| `flag` | `''` or `'yes'` |
| `number` | a finite number |
| `bool` | true or false |
| `object` | a plain object |
| `list` | an array |
| `key` | a peer's public key, an Ed25519 key in SPKI form, base64 |
| `url` | an http or https address |
| `path` | a path inside the run folder: relative, no drive, no `..` |
| `name`, `description`, `paragraph` | a text by the field rules of `spirit/fieldRules.js` |

### `outcome(call)`

- **call**: a promise, usually a member call.
- **Answers** `{ status, body }` and never rejects: 200 and the body; 400 for a call the check refused before it left;
  the node's own status for its refusal; 0 when nothing answered.

### `tree()`

No arguments. Answers the node's api as it stands: `{ <family>: { <verb>: ... } }`, every family and verb this
caller may call.

### `error(text)`, `formatBytes(bytes, decimals)`, `escapeHtml(text)`

- `error(text)`: says `ERROR: <text>` on the console and answers `{ error: { string: text } }`.
- `formatBytes(bytes, decimals)`: a byte count as a reading, decimals 2 by default: `'0 Bytes'`, `'1 KB'`, `'1.5 KB'`,
  up to TB.
- `escapeHtml(text)`: the text with `& < > " '` escaped for HTML.

### `isNode()`, `isBrowser()`, `isLoopback()`

No arguments; true or false. The only place anything asks where it runs.

### `VERSION`, `DEFAULT_SPIRIT_PORT`, `MIME_TYPES`, `debug(on)`

The node's and the relay's too, in node and on a page alike:

- `VERSION`: the SpiritOS version, `'0.0.1'`; the relay and `/api/version` report it.
- `DEFAULT_SPIRIT_PORT`: 65432, the port a node listens on when it is started without one. spirit.js never guesses its
  own node's port from it (above).
- `MIME_TYPES`: the content type of a file by its extension, `'.js'` to `'application/javascript; charset=utf-8'`.
- `debug(on)`: the process's one debug switch, off at start, in RAM only, never persisted. A boolean sets it; anything
  else only reads it; it answers the state that resulted. The node's, the relay's and every server's `DEBUG` verb set
  this one.

### `events`: `subscribe(handlers)`, `publish(obj)`

The node's events family, its one dispatcher (Andy, 2026-10-25: "two verbs on events - publish - subscribe", and
"ONE path for everybody to publish events"). spirit.js holds both members itself; binding the family adds nothing
over them.

- **`subscribe(handlers)`**: the VM's one stream of the node's events, shared by every subscriber. handlers, all
  optional: `onConnection(up)`, `onSnapshot(jobs)` (the jobs as they stand), `onUpdate(job)`, `onDelete(id)`,
  `onPacket(message)`, `onRelayEvent(row)`, `onContactRename(row)`, `onReconnect()`. One that subscribes later is
  handed the jobs as they stand and told the stream is up. It opens once the page has parsed, comes back by itself
  2 s after it ends, and closes when nobody is left. On a face it hands the handlers to the face's link
  (`window.spirit.transport.events`). **Answers** the unsubscribe.
- **`publish(obj)`**, in node: below, with the job.

### On a page only: `start()`, `ready`

`start()` binds every family the node names on `window.spirit`, once, and answers the instance; `ready` is that
promise. The face shell calls it once its link is up, the home page at load.

### In node only: `node`, `jobs`, `events.publish`, and no kernel

spirit.js requires no `kernel.js`, and hands out no `spirit.core`: what a server took from the kernel is spirit.js's own.

- **`spirit.node`**: `{ port, name, key, ownerKey }`. The port is the one read from `environment.json`; the name, key and
  owner key are what the node hands every server it starts as `--node`, all public, `''` when not given.
- **This process's own job**, published to the node by `events.publish` with its own id (`SPIRIT_JOB_ID`), one post each,
  the one path; the node changes the job and every subscriber hears it:

| | takes | does |
|---|---|---|
| `spirit.events.publish(obj)` | a plain object | the object as the job's app, every page hears it; answers true. Over the payload cap it is not sent: the pages hear `{ dropped: { bytes, max } }`, and it answers false |
| `spirit.jobs.start(name)` | the job's name | opens it; a start while one is open refuses `job-open` |
| `spirit.jobs.progress(done, total, text)` | counts and a line | the bar; total 0 means unknown |
| `spirit.jobs.end(result)` | a result, or an Error | closes the job |
| `spirit.jobs.report(patch)`, `log(text)`, `complete(data)`, `fail(error)` | | the job's own state and its three common forms; `no-job` outside a job |

  start, progress and end resolve once the node has them, so awaited calls arrive in order. When the jobs family is
  bound (`spirit.require('spirit/jobs/api.js')`), its verbs are added to the same `spirit.jobs`.

## What the red must try to break

- A second spirit: requiring it again, or after something else set a global spirit; a factory or a `call` on it.
- Anything but `isNode()` and `isBrowser()` asking where it runs; more than one post and one get.
- Every rule, with a good value and a bad one; an unknown argument, a missing one, arguments not an object.
- A family asked by two callers at once being asked twice; a family the node lacks.
- No port in `environment.json`: no default guessed.
- A component that is not there, in node and on a page; the same component answering differently in the two.
- A module that requires something before spirit.js.

## Not yet

`face.html` holds spirit.js alone, and spirit.js loads the face shell. The face's link to its home node (the login,
the sealed calls, the stream, the files) is still built by `face/shell.js`, which hands it to spirit.js as
`window.spirit.transport`; it moves into spirit.js.
