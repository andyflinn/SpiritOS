# spirit.js

`spirit/run/spirit.js`, the spirit object. Its red is `./spirit.js`, which asserts this document section by section.

## The rule

**spirit.js is the only JavaScript client interface to the SpiritOS core.** Every module and every page loads it
first, and does everything through the spirit object it makes: no link, fetch or server interface of its own beside
it. A module whose first require is not spirit.js goes red (`./spirit-child-generalRules.js`).

## Its role

The one door. It holds the checks and the transports, builds one member per node family, and loads every other
component. It is the only place that tells a page from node. The node server and the relay server build their own
spirit (`spirit/kernel.js`); everything else is a client of the core and gets in through this file.

## Where it runs

| | |
|---|---|
| `isNode()` | true when loaded by node (`module` and `process.versions.node` exist) |
| `isBrowser()` | true on a page: not node, and the global is `window` |

No other line of spirit.js asks where it runs, and no other file is to ask.

## The global, first

Before anything else, spirit.js sets the global `spirit` (on a page `window.spirit`, in node `globalThis.spirit`). A
global spirit already there is the one it fills, never replaced. Everything below is added to that one object, and
requiring spirit.js again answers the same object.

## The one standard interface

The same object for a face, a home page and a node.js component. What it holds:

- **One member per node family.** Each verb of the family is an async function, `spirit.<family>.<verb>(args)`,
  answering the reply's body. A dotted verb is also there in camel case (`line.write` as `lineWrite`). Each family
  also has the folder verbs `spirit.<family>.FS.<verb>` (loadFile, saveFile, deleteFile, statFile, fileExists,
  loadJsonValue, saveJsonValue, getAnnotations, annotateFile, search) and the names its own `api.js` adds.
- **`spirit.call(name, args)`**: the member call of that name, for a caller that names its verb at run time;
  `no-such-verb` for one the object does not hold.
- **`spirit.tree()`**: the node's api answer as it stands.
- **The check.** Every call is checked before it leaves: an argument the verb does not name refuses
  `no-such-argument`; a missing one, or one breaking its rule, `bad-request`. A refused call never reaches the node.
  The node checks everything again.
- **A refusal** keeps the node's code, its own words (its error, else the first line of a plain-text answer) and its
  status.

The node families are found, not listed: `api` names them, `api {family}` answers each family's `api.js`, which runs
here as a module and is bound under the name the node gave it.

## The one loader: `spirit.require(path, key)`

The one async function that loads every other component, the same on a page and in node. `path` is from the run root.

| path | in node | on a page |
|---|---|---|
| a component | required from the run root, its `module.exports` | fetched through the transport's `file`, run, its `module.exports`; `not-found` when it is not there |
| an interface: `<name>/<name>.family/api.js` or `spirit/<name>/api.js` | bound as `spirit.<name>` from this process's own node, the one `SPIRIT_CALLBACK_URL` names; `no-node` without one, never the default port | bound as `spirit.<name>` through `api {family}` |
| an interface with `key` | the peer's family, through `spirit.peerPost` | the peer's family, through the home node's `peer.post` |

## Its functions

| Function | Takes | Answers | Refuses |
|---|---|---|---|
| `isNode()`, `isBrowser()` | nothing | true or false | never |
| `error(text)` | a text | `{ error: { string } }`, and says it on the console | never |
| `formatBytes(n, decimals)` | a byte count | `'0 Bytes'`, `'1 KB'`, `'1.5 KB'` | never |
| `escapeHtml(text)` | a text | the text with `& < > " '` escaped | never |
| `check(name, spec, args)` | a verb's name, its declaration, the arguments | null when they pass, else the refusal | `no-such-argument`, `bad-request` |
| `rules` | | the rules by name: text, id, flag, number, bool, object, list, key, url, path, name, description, paragraph | |
| `nodeTransport(url)` | the node's loopback url | `{ ask(verb, args), file(path) }`: posts `{verb, ...args}` to `url/api/spirit`, answers `{status, text, body}`; a file through `fs.load` | |
| `pageTransport()` | nothing | the same two, through `window.spirit.transport` when a link is set, else the node's own door `/api/spirit` and files by their path | |
| `peerTransport(post)` | the caller's post to a peer | the same two, as the peer's apiDoor takes them: `'api'`, `{api: {family}}`, `{family: {verb: args}}`; an answer with ok false is status 409, one that never reached the peer 0 | |
| `loadInterface(source, name)` | a family's `api.js` text | its `module.exports` | |
| `assemble(transport, defs)` | a transport and family definitions | the spirit object at once, one member per definition | |
| `createSpirit(transport)` | a transport | a promise of the spirit object, every family the node names bound; one without an interface left off | |
| `forNode(url, family)` | a node's loopback url | one object per url; the family asked for once, bound when the node answers | |
| `forPeer(key, post, family)` | a peer's key and post | one object per key; two callers at once ask once | |
| `outcome(call)` | a call | `{status, body}`: 200 and the body; 400 for a call the check refused; the node's status for its refusal; 0 when nothing answered | |
| `require(path, key)` | see the one loader | a promise of the component or the bound family | `no-node`, `no-interface`, `not-found` |

**In node only**, what a script took from `kernel.js` until now, under the kernel's names: `spirit.core.jobs`,
`spirit.core.node`, `spirit.core.util`, `spirit.core.fs`, `spirit.core.const` (with `VERSION`, and spirit.js's own
`MIME_TYPES`), `spirit.peerPost`.

**On a page only**: `spirit.start()` binds the node's families on `window.spirit` once and answers the object;
`spirit.ready` is that start.

## What the red must try to break

- A second spirit: requiring it again, or after something else set a global spirit.
- Anything but `isNode()` and `isBrowser()` asking where it runs.
- Every rule, with a good value and a bad one; an unknown argument, a missing one, arguments not an object.
- A call refused by the check reaching the node.
- An interface asked with no node of its own.
- A component that is not there, in node and on a page.
- The same component required in node and on a page answering differently.
- A module that requires something before spirit.js.

## Not yet

The face's link to its home node (the login, the seal, the sealed calls, the stream, the files) is still built by
`face/shell.js`, which hands it to spirit.js as `window.spirit.transport`. It moves into spirit.js next, and
`face.html` then holds spirit.js alone.
