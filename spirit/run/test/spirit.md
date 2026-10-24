# spirit.js

`spirit/run/spirit.js`, the spirit object. Its red is `./spirit.js`, which asserts this document section by section.

## The rule

**spirit.js is the only JavaScript client interface to the SpiritOS core.** Every module and every page loads it
first and does everything through it. A module whose first require is not spirit.js goes red
(`./spirit-child-generalRules.js`).

## Its role

The one door. It is the only place that tells a page from node, it reaches the node by one post and one get, it puts
the node's families on itself, and it loads every other component. The node server and the relay server build their
own spirit (`spirit/kernel.js`); everything else is a client of the core and gets in through this file.

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

No other line of spirit.js asks where it runs, and no other file is to ask.

## Its node

- **On a page**: the page's own origin, or the face's link to its home node when one is set (`window.spirit.transport`).
- **In node**: `127.0.0.1` and the `PORT` of `relay-state/environment.json` in the run root spirit.js sits in, read
  when spirit.js is required. The node's server writes that file through `serveCommon.writeEnvironment` before it
  starts any server process. No port, no node: calls refuse `no-node`, and no default port is guessed.

## One post and one get

Nothing else in spirit.js reaches the node.

| | |
|---|---|
| `post(verb, args)` | sends `{verb, ...args}` to the node's `/api/spirit`; answers `{status, text, body}` |
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
  keeps retrying a busy relay; `kind: 'background'`, a post that may wait behind others; `node`, the node that posts
  it (this VM's own by default).
- **Answers** the peer's answer body; `{ ok: false, code: 'not-posted' }` at once for a post the node refused;
  `{ ok: false, code: 'no-answer' }` after `waitMs` of silence. It resolves, never rejects.
- In node it is the kernel's peerPost, through this VM's own node; on a page, the home node's `peer.post`.

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

### `isNode()`, `isBrowser()`

No arguments; true or false. The only place anything asks where it runs.

### On a page only: `start()`, `ready`

`start()` binds every family the node names on `window.spirit`, once, and answers the instance; `ready` is that
promise. The face shell calls it once its link is up, the home page at load.

### In node only: the kernel's names

What a script took from `kernel.js`, under the kernel's names, until kernel.js goes:

| | holds |
|---|---|
| `spirit.core.jobs` | report, log, complete, fail, publish, start, progress, end, cycle |
| `spirit.core.node` | the node's constants (`const`) and helpers (`util`) |
| `spirit.core.util` | print, debug, error, formatBytes, escapeHtml |
| `spirit.core.fs` | loadFile, statFile, fileWritable, fileServable, saveFile, loadJsonValue, saveJsonValue, deleteFile, annotateFile, annotateFace, getAnnotations, fileExists |
| `spirit.core.const` | AUTHOR, COPYRIGHT, VERSION, ICON, IS_NODE, IS_BROWSER, and spirit.js's own MIME_TYPES |

`IS_NODE` and `IS_BROWSER` are the kernel's own telling of where it runs, which rule one gives to `isNode()` and
`isBrowser()` alone; they go with kernel.js.

## What the red must try to break

- A second spirit: requiring it again, or after something else set a global spirit; a factory or a `call` on it.
- Anything but `isNode()` and `isBrowser()` asking where it runs; more than one post and one get.
- Every rule, with a good value and a bad one; an unknown argument, a missing one, arguments not an object.
- A family asked by two callers at once being asked twice; a family the node lacks.
- No port in `environment.json`: no default guessed.
- A component that is not there, in node and on a page; the same component answering differently in the two.
- A module that requires something before spirit.js.

## Not yet

The face's link to its home node (the login, the seal, the sealed calls, the stream, the files) is still built by
`face/shell.js`, which hands it to spirit.js as `window.spirit.transport`. It moves into spirit.js, and `face.html`
then holds spirit.js alone.
