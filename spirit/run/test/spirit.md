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

Each verb of a family is an async function answering the reply's body. Before a call leaves, every argument is
checked against the family's `api.js`: an argument the verb does not name refuses `no-such-argument`; a missing one,
or one breaking its rule, `bad-request`. The node checks everything again. A refusal from the node keeps its code,
its own words (its error, else the first line of a plain-text answer) and its status. A dotted verb is also there in
camel case (`line.write` as `lineWrite`); each family has the folder verbs `spirit.<family>.FS.<verb>` and the names
its own `api.js` adds.

A caller that holds a verb's name in a variable writes `spirit[family][verb](args)`. There is no `spirit.call`.

## The one loader: `spirit.require(path, key, how)`

The one async function that loads every other component, the same on a page and in node. `path` is from the run root.

| path | in node | on a page |
|---|---|---|
| a component | required from the run root, its `module.exports` | got by `get`, run, its `module.exports`; `not-found` when it is not there |
| an interface: `<name>/<name>.family/api.js` or `spirit/<name>/api.js` | binds `spirit.<name>` from its node, asked once by any number of callers at once; `no-interface` for a family the node lacks | the same |
| an interface with `key` | the peer's family, through `spirit.peerPost` with `how`; held under the key, not on the instance | the peer's family, through the home node's `peer.post` |

On a page, `spirit.start()` binds every family the node names on `window.spirit`, once; `spirit.ready` is that start.

## Its other members

| Member | Takes | Answers |
|---|---|---|
| `error(text)` | a text | `{ error: { string } }`, said on the console |
| `formatBytes(n, decimals)` | a byte count | `'0 Bytes'`, `'1 KB'`, `'1.5 KB'` |
| `escapeHtml(text)` | a text | the text with `& < > " '` escaped |
| `check(name, spec, args)` | a verb's name, its declaration, the arguments | null when they pass, else the refusal |
| `rules` | | the rule names: text, id, flag, number, bool, object, list, key, url, path, name, description, paragraph |
| `outcome(call)` | a call | `{status, body}`: 200 and the body; 400 for a call the check refused; the node's status; 0 when nothing answered |
| `tree()` | nothing | the node's api answer as it stands |
| `peerPost(peer, app, body, how)` | | in node, the kernel's peerPost through this VM's own node; on a page, the home node's `peer.post` |

**In node only**, what a script took from `kernel.js`, under the kernel's names, until kernel.js goes:
`spirit.core.jobs`, `spirit.core.node`, `spirit.core.util`, `spirit.core.fs`, `spirit.core.const` (with `VERSION`, and
spirit.js's own `MIME_TYPES`).

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
