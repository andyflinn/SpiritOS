# Every branch, every rule of a branch

goal/G43.32. Its test is `./spirit-branches.js`, a test outside every branch, named after `spirit.js`, which finds the
branches (`familyPath`, `cacheManager`); a test named after no module is garbage (`./spirit-sibling-noFuckingGarbage.md`).

Andy: *"make sure nobody can add an app implementing a family, without adhering to the rules, this means that a test
outside of each branch must assert this."*, *"such a general test must therefore "recognize" a branch folder, and assert
all rulers relating to branches."*, and to Q6 (*"Shall wsl gather the 8 branch rules (in chat) into one new
spirit/test/branches.js that finds every api.js folder itself, removing their copies from the 6 tests?"*): *"absolutely,
AND MAKE SURE NO TEST GETS LOST."*

It took in five tests whole, each now a section: `spirit-familyFinder.js` (A), `data-caches.js` (B),
`apiDoor-familyGate.js` (C), `server-appFamily.js` (D), `introSpector-branchVerbs.js` (E). Every check they made, 211 on
the day they moved, is made here, by the same words. Scratch nodes only; neither Andy's node nor an agent's is touched.

## Requirements

### The tree

The tree is every file git keeps and every file not yet added that git does not ignore, so a new app's branch is judged
before it is committed (Andy: *"make sure nobody can add an app implementing a family, without adhering to the rules"*).

### 0. A branch folder, recognized

- **A branch folder is a folder holding an `api.js` that is a module** (`module.exports`): its interface. An `api.js` that
  is a page script (`spirit/element/search/api.js`, the app-server selector, an element) is no branch, nor is one in a test
  folder. Its name is its folder's (`spirit/app/api.js` is `app`). It must have found over 10, desk's and fs's among them.
- Each branch, its own checks, named by its `api.js`:
  - **Its verb rules live in its `api.js`** (decided 7): it loads, and declares each verb as its arguments and their rules.
  - **It stands where its family is found** (goal/G43.27): `spirit.familyPath(<name>)` is its `api.js`, so a branch folder
    no finder reaches (one nested deeper, a second of the name) is red.
  - **Required on the node it is placed and binds** (decided 8: *"A branch's api.js is placed at
    spirit.required.spirit.<branch-path>.api and also binds the branch."*): in a process of its own, `spirit.require` of it
    leaves the `api.js` at `spirit.required.<its path>`, and binds every verb it declares on `spirit.<name>`, under the
    name its `functions` gives it if any (`spirit/app/api.js`: `search` is `searchApp`).

### A. A family found by its name (goal/G43.27)

Andy: *"make sure there's a test for the module searching for api's that makes sure those rules are followed - less path
elements get priority, - the target needs an api.js - and duplicate <name>/api.js raise a red."*, and *"spirit/app/contact/
does NOT have an api.js"*. The finding is judged on a real page (headless Chrome) of a scratch node; folders that break the
rules are planted into the scratch node's copy, never into the tree.

- **3. No `<name>/api.js` twice in the tree.** A family interface is any of `spirit/<name>/api.js`, `spirit/app/<name>/api.js`
  and `process/js/<name>/[family/]api.js`. A second relay/api.js planted into the scratch copy is seen as a duplicate.
- **2. The target needs an api.js.** A `spirit/app/contact/data.js` planted beside no api.js never runs, and contact loads
  `spirit/contact/data.js`.
- **1. The fewest path elements win.** A planted `spirit/app/relay/` with its own api.js and data.js loses to `spirit/relay/`,
  whose data.js is the one loaded.
- **An app's family is found where its api.js is.** The agent app's api.js is in `spirit/app/agent/` alone, so
  `spirit/app/agent/data.js` is loaded.
- **No data.js is asked that is not there (no 404).**
- **goal/G43.20, a family's path in a process.** The box: *"a family is found as spirit/<name>/api.js or
  spirit/app/<name>/api.js, a job is named by its route, and nothing falls back to process/js/<name>"*. In a process,
  `spirit.familyPath` gives a system family's own `spirit/<name>/api.js` (fs), an app's `spirit/app/<name>/api.js` (desk,
  agent), and no path it gives names `process/js`, a name of no family's included.

### B. Every family's cache, one code in the browser and in node (goal/G41.28)

Andy, on G41.28: *"WSL, make sure you assert that every family in the api tree HAS a clientCacheManager, AND the a
node.js Process like DeskClient uses the Exact same code as the browser for the cache management. The only difference
is the appServer serializes the cache to disk."*

1. **Every branch has a data.js**: each branch folder recognized in 0 has `data.js` beside its `api.js`. Each is its own
   check, named by the branch.
2. **One code**:
   - the data set is one file, `spirit/data.js`: `spirit.js` brings it to a page, appServer requires the same file;
   - appServer takes a family's cache from the family's own `data.js`;
   - a manager's branches (the names it gives `var` constants, `var ITEMS = 'desk'`) are named by it alone: no other
     file hands a path of them to a `spirit.data` reader or writer (`D.get('desk/' + id)`). Every other file asks the
     manager.
3. **The same rows make the same cache**: the desk's `data.js` and the data set, run in node as appServer runs them
   (required, on the process's global) and in a page's window as a page runs them (plain scripts, no module), are told
   the same serving node (`homeNode(key)`, a key holding a `+` and a `/`) and handed the same rows (two goal pushes, an
   item as a JSON string, a rule), and end with the same `spirit.data.desk.cache`. Its top level is that node alone, its
   key in base64url (Q5 of goal/G43.7: *"yes."*).
4. **The one difference is the disk**: no `data.js` requires `fs` or `path`, writes or reads a file, or uses the
   browser's storage; appServer writes each sender's cache to its own file; no other module writes a cache file of its
   own.
5. **One contract**: every `data.js` stands through `spirit.data.makeFamily`, required or loaded, so its reads are at
   `spirit.data.<name>.data`, for clients to ask. Its cache rules (`cache`, an object) are exported where its family's
   clients keep a cache file, for appServer.
6. **Found and downloaded by introspection** (Andy, on G41.28: *"We're not done until every family of the API tree as a
   clientCacheManager, and clients can use that to organize their spirit.data, and the shell can introspect to find and
   download their clientCacheManagers."*):
   - `spirit.js` knows where a family's `data.js` lives, so a page finds it by the family's name alone;
   - for every family the node's own api tree names (a scratch node, `api`), the shell finds its manager by the folder
     shape, as `spirit.cacheManager` does (goal/G43.27): `spirit/app/<name>/data.js` for an app, `spirit/<name>/data.js`
     for a node family; no family's FS is asked. The node serves it as a script that calls `spirit.data.makeFamily`. Each
     family is its own check. The scratch node runs no app server, so its tree names the node's own families and the file
     server; every branch the tree holds is asked in 1.
7. **No other way** (Andy, the box: *"anything not using the new spiritData.js and it's buddies clientCacheManager.js
   must do so in this item. no exceptions."*, and *"any notion that there is an alternative approach must disappear
   from all documentation and all comments and all code and tests in the entire repo."*):
   - no client file (under `shell/`, `spirit/element/` or `spirit/app/`, but `shell/boot.js`, the face's own transport)
     takes the node's stream itself (`events.subscribe`): only `spirit/data.js` takes it, for every client. Those paths
     are the test's; `boot.js` and `seal.js` have been in `spirit/shell/` since goal/G43.18, which the list does not
     reach, so `spirit/shell/seal.js` is not judged; the apps left in `shell/` are, and every app of `spirit/app/`,
     where the apps and the servers moved (goal/G43.20);
   - no file of the repo (`.js`, `.md`, `.html`, `.json`; Andy's vault and this test and its spec aside) names a
     replaced way: a page or client that runs `uncached`, the desk's two-level branches (`deskItem/`, `deskItems/`,
     `deskState/`), `D.data.<branch>`. The list names the ways replaced so far; any other notion is read for by hand.
8. **A branch's watch is called `watch`** (Andy, goal/G43.32: *"that's a decision: a BRANCHE's what is called
   "watch""*, *"the branch is already implied in it's containing object."*, *"wsl, assert this in a test for
   branches."*): every object a family's reads hold (`spirit.data.<name>.data`, and each object inside it) is a branch.
   - Its watch is the member named `watch`, and no member is named `watch` and more (`watchFile`, `watchApp`, `watchRow`
     are the names it replaces). Each family is its own check.
   - A watch is never told its branch, the object it sits on: it takes the function and at most the row it narrows to,
     `watch(fn)` or `watch(id, fn)`, so no more than two parameters.

### C. The node's own families have a gate at the door (goal/G41.30)

Andy, of *"only the spirit object checks those rules, on the caller's side. A raw call to /api/spirit, the attacker's
way, reaches the handler unchecked"*: *"this needs fixing in this item."*; `spirit.js`: *"The node stays the gate and
checks everything again."*

- **Every broken call is refused at the door.** From each branch `spirit/<family>/api.js` recognized in 0, its verbs and
  each argument's rule, a raw call over http, no spirit object, breaks a verb's arguments three ways: an argument of the
  wrong type, a required one left out, one the verb does not name. Each must answer a 4xx with a `code`, never a 2xx, a
  5xx, a handler failed, or no answer within 8 s.
- It runs on a scratch node. It must have judged something: over 5 families and over 100 calls.

### D. The node finds an app's family at the app's top (goal/G43.27, requirement 2)

Andy: *"spirit/app/<name>/ folders are now ALMOST the same shape as spirit/jobs/ and other system api-branches, EXCEPT,
api.js sits in a folder ./api.js"*, *"i think the shape needs alignment."*. A scratch node with the agent app switched on
(`app.active`).

- server.js familyDir looks for `spirit/app/<name>/api.js`; appServer.js withAgents takes the app folder itself as the
  family folder:
  - the interface the node serves for `agent` is `spirit/app/agent/api.js`;
  - the agent branch carries no FS set (goal/G43.20): its files are spirit.fs's, by the path its id names.

### E. Every api branch serves exactly its own verbs (goal/G43.20)

introSpector.js gave every api branch the FS group (G41.28). Andy, on taking it away now that an api id is the path of its
folder: *"IN THIS ONE, OR WE'LL NEVER GET FUCKING DONE."*, *"WSL, NOTE AND ASSERT THIS IN YOUR TESTS, IN THE PROPER
PLACE, DILIGENTLY WITHOUT FUCKING CHEATING."*, and of its annotation verbs, *"ANNOTATIONS WILL BE NODE ONLY."* A real node
on a scratch copy of the tracked files, desk switched on (its branch read once its server answers it).

- Each branch serves exactly the verbs its own `api.js` declares (`spirit/<name>/api.js` or `spirit/app/<name>/api.js`):
  nothing more (the FS group introSpector.js added, G41.28, is no verb of any api.js), nothing less. Beyond an api.js
  only what was decided: appServer's `DEBUG` on every server (desk/G2.5: *"DEBUG auto-verb supplied by appServer is
  approved."*), and desk's `item.rules.add` and `item.rules.remove`, his alone and left out of its api.js on purpose
  (goal/G40.12).
- Nothing asserts that a removed verb is gone.

## What its test must try to break

- A new app, not yet committed, whose branch breaks a rule: shown red with a planted `spirit/app/zzplant/` whose cache
  names a `watchGlyph`.
- A branch folder no finder reaches; an `api.js` that does not load or declares no verbs; one required on the node that
  is not placed at `spirit.required.<its path>` or leaves a verb unbound.
- A family without a data.js; a data set or a manager loaded from somewhere else by node than by the page; a file other
  than the manager naming one of its branches; a manager that does one thing in node and another in a page; a manager
  that keeps its cache itself, on disk or in browser storage; a module writing a cache file besides appServer; a manager
  without the contract; a page that cannot find a family's manager by its name; a manager the node does not serve.
- A branch whose watch has another name (`watchRow`), or a watch told its branch (`watch(table, id, fn)`).
- A second `<name>/api.js`; a data.js beside no api.js taken for a family; a deeper folder winning over a shallower one.
- A handler reached by a call its own family's declaration refuses.
- A branch serving a verb its api.js does not declare, or not serving one it does.
