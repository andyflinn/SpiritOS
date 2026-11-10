# spirit.js

`spirit/run/spirit/spirit.js` (at the run root until goal/G43.18, served at /spirit.js as before), the spirit object. Its red is `./spirit.js`, which asserts this document section by section.

## The rule

**spirit.js is the only JavaScript client interface to the SpiritOS core.** Every module and every page loads it
first and does everything through it. A module whose first require is not spirit.js goes red
(`./spirit-child-generalRules.js`).

## Its role

The one door. It is the only place that tells a page from node, it reaches the node by one post and one get, it puts
the node's families on itself, and it loads every other component. Everything is a client of the core and gets in
through this file, the node server and the relay server too, for the version, the MIME table, the debug switch and the
default port.

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
- **In node**: `127.0.0.1` and the `PORT` of `spirit/state/environment.json` in the run root spirit.js sits in, read
  when spirit.js is required. The node's server writes that file through `serveCommon.writeEnvironment` before it
  starts any server process. No port, no node: calls refuse `no-node`, and no default port is guessed.

## One post and one get

Nothing else in spirit.js reaches the node. Its other three fetches are the relay's face routes (goal/G43.18, Q22):
the login's `/face/api`, and the link's `/face/call`, whole and piece by piece; the red counts five fetches, three of
them those.

| | |
|---|---|
| `post(verb, args, how)` | sends `{ call: verb, args }` to the node's `/api/spirit` (goal/G41.15), or on a face through `window.spirit.transport`; answers `{status, text, body}`. With `how.stream` it answers the response itself, read as it comes (the events family's subscribe); `how.headers` are sent along |
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
  `api.js` adds, and no FS set (goal/G43.20; Andy: *"those owner only FS verbs are no longer needed, because not the
  api ID spirit.fs or spirit.api.desk ARE the path to all those files"*): a family's files are `spirit.fs`'s, by path.

A caller that holds a verb's name in a variable writes `spirit[family][verb](args)`. There is no `spirit.call`.

## The one loader: `spirit.require(path, key, how)`

The one function that loads every other component: on a page it answers once the file has been fetched and run, on the
node at once (below).

- **path**: a run-root path, '/'-separated; a leading '/' is dropped.
- **key**: left out or null for this VM's own node; a peer's public key for that peer's family (an interface path only).
- **how**: with a key, in node, handed to `spirit.peerPost` as its `how` (below).

| path | in node | on a page |
|---|---|---|
| a component | required from the run root, its `module.exports` | got by `get` and run as a plain script, with no module box, so a file written for both node and a page takes its page branch and puts itself on the page (every shell element does; CodeMirror and its mode files too, goal/G41.7); a stylesheet is put on the page as a style; answers an empty object; `not-found` when it is not there |
| an interface: `spirit/app/<name>/api.js` or `spirit/<name>/api.js` (`spirit.familyPath(name)`) | binds `spirit.<name>` from its node and answers it, asked once by any number of callers at once; `no-interface` for a family the node lacks, `no-node` with no port | the same |
| an interface with `key` | the peer's family, through `spirit.peerPost` with `how`; held under the key, not on the instance | the peer's family, through the home node's `peer.post` |

**`spirit.required.<path>`** (goal/G43.32; Andy: *"spirit.require() both on the node, AND on the browser should simply
install every script required, at the following point: spirit.required.<path.of.fucking.script>. - no name collisions -
easily checkable if script is already loaded."*): every script required stands at `spirit.required`, its run-root path
one key per folder and its name without `.js` the last (`spirit/relayUrl.js` at `spirit.required.spirit.relayUrl`), on
the node and on a page. A script never required has no place there. A file and the folder of its name both stand:
`spirit/app.js` at `spirit.required.spirit.app`, with `spirit/app/api.js` under it, though `spirit.js` makes that
first level ahead.

**A peer's branch is made from the caller's own copy** (goal/G43.32; Andy: *"clients don't run code from afar, they
run their own FUCKING copy"*, *"DO IT! WITH CODE FROM THE OWN NODE!"*): `spirit.require(<branch>/api.js, key)` makes the
peer's `spirit.<branch>.<verb>` functions from the caller's own `api.js` of that branch, on its own disc; the peer is
asked only to answer each call, never for its `api.js`, and nothing a peer hands back is run.

**On the node it answers at once** (Andy: *"box that spirit.require() on the node is just a path-translating
wrapper."*): a script's `module.exports`, not a promise, the same answer every time it is asked. An interface is still
bound by asking a node, so it stays a promise.

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
- In node: one post of `peer.post`, and the answer read off the node's events (`event.subscribe`, a stream through
  `post`), as a server, so it is handed no backlog and marks nothing taken; on a page, the home node's `peer.post`.
- In a process, `spirit.event.subscribe` opens the stream as a server too (goal/G43.3), so it takes none of the waiting
  lines of its node's owner.

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

`start()` asks no api (goal/G43.27, Q1; Andy: *"shouldn't it work without making a call, since the elements will trigger
the necessary calls?"*, *"Q1: clear"*). The only family it calls is node, for `node.card`, and that family's api is asked
then. `ready` is that promise. It answers the instance, seen so that any family named on it stands there and binds the
first time it is called. A call to a family with no interface is refused `no-interface`. `window.spirit` itself stays
the plain instance. The face shell calls `start()` once its link is up, the home page at load.

**An app switched on after the page loaded works with no reload** (section 9): desk, off at load, is switched on from
the page. The Desk element, opened on that same page, asks `desk.items.search` itself and draws.

**No api up front** (goal/G43.27; Andy: *"MAKE SURE spirit.js doesn't load every fucking api upfront!!!!!!!!!!!!!!"*).
The red loads the home page in a real browser (headless Chrome) on a scratch node and counts every call to the node's
door (section 9): the page never asks for the whole api (`api` with no family); a family's api is asked only when the
page calls one of its verbs, and never twice; a family the page has not touched, required later, costs one `api` call
then and none on the next. A check that finds nothing to judge is red.

**No file it does not need yet** (goal/G43.27; Andy: *"all, spirit.js still seems to be loading all sorts of shit that it
doesn't need yet."*, *"wsl, I SAID, make sure that spirit.js does NOT load all that shit!!!!!!!!!"*). Every file the page
fetches as it loads, with what asked for it: no file is fetched twice; every script but `spirit.js` and the shell's
`boot.js` is loaded by `spirit.require` when something requires it, none from a list fetched up front; and the home
page opens no app's detail, so none of the detail's files (`appSelector/detailElement.js`, `appInstaller.js`,
`serverDEBUG.js`, `changeAppIcon.js`, `changeAppLabel.js`, `rowFormSetShell.js`) is fetched.

**An app switched on after the page loaded works, no reload** (goal/G43.27, Q1; Andy: *"shouldn't it work without
making a call, since the elements will trigger the necessary calls?"*, and *"wsl, make sure your reds assert that as
well!"*). On that same page, desk, off at load, is switched on (`app.active`); once its server answers, the Desk element
is opened: it asks `desk.items.search` itself and draws its list, never *"the desk server did not answer"*.

### In node only: `node`, `jobs`, `events.publish`

spirit.js hands out no `spirit.core`: what a server needs is spirit.js's own.

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
- **How a face gets it** (goal/G41.19; Andy: "LOAD IT WITH A FUCKING SCRIPT TAG!"): `face.html` loads it by one tag,
  `<script src="/spirit.js"></script>`, and no other script. The node and the relay serve `face.html` byte for byte as
  it is on disk; no server pastes spirit.js into a page.
- **Started on a page, it loads the cache and no element** (goal/G41.19: no preloading elements): `spirit.data`, and
  nothing else from `shell/`. Whoever draws with a data set loads its row element.

## What the red must try to break

- A second spirit: requiring it again, or after something else set a global spirit; a factory or a `call` on it.
- Anything but `isNode()` and `isBrowser()` asking where it runs; more than one post and one get.
- Every rule, with a good value and a bad one; an unknown argument, a missing one, arguments not an object.
- A family asked by two callers at once being asked twice; a family the node lacks.
- No port in `environment.json`: no default guessed.
- A component that is not there, in node and on a page; the same component answering differently in the two.
- A module that requires something before spirit.js.

## The face page

`face.html` holds spirit.js alone, and spirit.js loads the face shell (goal/G43.18, box v29). The face's link to its
home node (the login, `spirit.login`; the sealed calls through `shell/seal.js`; the stream; the files) is built in
spirit.js itself and set as `spirit.link` and `window.spirit.transport`; `spirit.face` says where the page stands,
`{ home, loggedIn, name }`, and `spirit.booted` answers once `boot.js` runs. The red asserts that every call goes
through a `window.spirit.transport` once set, and that on the home node's own page spirit.js gets `shell/boot.js`
alone and `spirit.booted` answers (sections 6 and 6b); a login and the sealed link themselves are not run.

## A page finds data.js by the folder shape (the cache manager)

goal/G43.27, requirement 6. Its test is a section of `./spirit.js`: spirit.js read as it is, comments stripped, and a real
page (headless Chrome) of a scratch node with the agent app switched on, never a live one.

Andy: "spirit.js can be fixed, no? it knows the difference between an app and a system branch?"

### Requirements

- **6. A page finds `data.js` by the folder shape.** spirit.js's cacheManager asks no `FS.path`, and spirit.js asks
  `FS.path` nowhere. On a real page of a scratch node, every family the node names whose data.js is in the tree is loaded
  by `spirit.cacheManager`, contact among them (an app and a system family share that name).

## The element move

The move of the elements out of `shell/js` (goal/G43.5). Its test is a section of `./spirit.js`. Its lists are what `shell/js` held when the item began.

Andy, box: *"We are ONLY moving the contents of "run://shell/js/" to "run://spirit/element/""*, and *"on the browsers, spirit object, these elements will live in "spirit.element" (SINGLULAR) and not on spirit.elementS!!!!"*

### Requirements

- `shell/js` is gone, and every file it held stands at `spirit/element/` under its own name and folder, its tests and documents with it. *"all elements will keep their name during this move."*
- No code, test or document under `spirit/` names `shell/js`, or reaches a moved element through `spirit.elements`, directly or through a local name for that object. *"both file-location AND the home in spirit.element (singular)"*, *"uncluding tests"*, *"including the contents of shell/ that remains"*, *"including, new code in spirit/app"*.
- The other way round too: no code reaches through `spirit.element` for an element `spirit/element/` does not define. Andy, live: *"contact detail don't load in contacts"*, because `contactDetails` asked `spirit.element` for `navigation`, which stayed on `spirit.elements`.
- Andy's own words are never rewritten: a double-quoted part of a comment or a document is left out of that scan. `agents/` and `design/` are left out too.
- On a real page `spirit.element` exists at start, every moved module loads from its new place, and all the moved elements stand on `spirit.element` and none on `spirit.elements`.
- The library is `spirit/element/codeMirror.js`'s own folder: `spirit/element/test/codeMirror.md`. What stays in `shell/shared/` is `shell/shared/js/test/deskRunStatus-home.md`.

### What else proves it

The move must break nothing, and that is the old suites' to say. A file moved is its own suite moved. `spirit/test/word.js` must then fail on `job` alone: `spirit/element/` and `spirit.element` give `element` its home.

## The relay login

goal/G43.18, box v29, *The relay login*. Its test is a section of `./spirit.js`: a real scratch node and relay, a face on a starred relay (box v29: a face only on one), its real login, and a real Chrome on the face at `<name>.localhost`.

Andy's box: *"The relay serves a logged-out face one plain page, the one-field form, with spirit.js and seal.js only, which make the sealed link home. boot.js, shell.css, face.css and every other part of the shell come from the home node over that link."* and *"The login is spirit.login, in spirit.js, no app. It holds the relay's own calls, state, login and logout on /face/api, and draws the one field when logged out. shell/login/ and its login.json go."*

### Requirements

- `shell/login/` is gone.
- The relay serves the face its page, `/spirit.js` and `/shell/seal.js`. Logged out or in, it does not itself serve `/shell/boot.js`, `/shell.css`, `/shell/face.css`, `/shell/login/login.js` or `/shell/login/login.json`.
- On the face, `spirit.login` holds `state`, `login` and `logout`. Logged out, the page shows one field and loads nothing but `spirit.js` and `seal.js` (its favicon and `/face/api` aside).
- Logged in, the face draws the home node's shell (Contacts on its list), and none of `boot.js`, `shell.css` or `face.css` came as the relay's own file.
- After `spirit.login.logout()`, the page shows the one field again, and the relay holds the login no more.

## How a family is found by its name

goal/G43.27, a section of `spirit/run/spirit/test/spirit.js`.

Andy: "make sure there's a test for the module searching for api's that makes sure those rules are followed - less path elements get priority, - the target needs an api.js - and duplicate <name>/api.js raise a red.", and "spirit/app/contact/ does NOT have an api.js".

The tree is read as it is. The finding is judged on a real page (headless Chrome) of a scratch node. Folders that break the rules are planted into the scratch node's copy, never into the tree.

### Requirements

- **3. A second `<name>/api.js` is seen.** A family interface is any of `spirit/<name>/api.js`, `spirit/app/<name>/api.js` and `process/js/<name>/[family/]api.js`. A second relay/api.js planted into the scratch copy is seen as a duplicate. That no branch's name has two in the tree is judged on each branch folder by `./spirit-sibling-branchRules.js` (goal/G43.32).
- **2. The target needs an api.js.** A `spirit/app/contact/data.js` planted beside no api.js never runs, and contact loads `spirit/contact/data.js`.
- **1. The fewest path elements win.** A planted `spirit/app/relay/` with its own api.js and data.js loses to `spirit/relay/`, whose data.js is the one loaded.
- An app's family found where its api.js is, and a page getting each branch's own `data.js`, are judged on each branch folder by `./spirit-sibling-branchRules.js` (goal/G43.32).
- **No data.js is asked that is not there (no 404).**

### goal/G43.20: a family's path in a process

The box: *"a family is found as spirit/<name>/api.js or spirit/app/<name>/api.js, a job is named by its route, and nothing
falls back to process/js/<name>"*. In a process, `spirit.familyPath` gives a system family's own `spirit/<name>/api.js`
(fs), an app's `spirit/app/<name>/api.js` (desk, agent), and no path it gives names `process/js`, a name of no family's
included.
