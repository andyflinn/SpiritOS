

## The caches part: one cache code in the browser and in node

One cache code in the browser and in node, the data set's side (goal/G41.28). A test by name of `spirit/data.js`: the
data set, and the two places a family's cache runs, a page and a server process that follows a stream (appServer). Its
test, once `./data-caches.js`, is a section of `./data.js`.

Andy, on G41.28: *"WSL, make sure you assert that every family in the api tree HAS a clientCacheManager, AND the a
node.js Process like DeskClient uses the Exact same code as the browser for the cache management. The only difference
is the appServer serializes the cache to disk."*

What every branch's `data.js` must be (there, its branches named by it alone, no disk, its contract, its watch, served
and found by its name) is judged on each branch folder by `./spirit-sibling-branchRules.js` (goal/G43.32, Q6, Q7). Here,
what judges no branch. The numbers are those of the requirements before they moved.

### Requirements

2. **One code**:
   - the data set is one file, `spirit/data.js`: `spirit.js` brings it to a page, appServer requires the same file;
   - appServer takes a family's cache from the family's own `data.js`.
3. **The same rows make the same cache**: the desk's `data.js` and the data set, run in node as appServer
   runs them (required, on the process's global) and in a page's window as a page runs them (plain scripts,
   no module), are told the same serving node (`homeNode(key)`, a key holding a `+` and a `/`) and handed the same rows (two
   goal pushes, an item as a JSON string, a rule), and end with the same `spirit.data.desk.cache`. Its top level is that node
   alone, its key in base64url (Q5 of goal/G43.7: *"yes."*).
4. **The one difference is the disk**: appServer writes each sender's cache to its own file; no other module writes a
   cache file of its own.
6. **Found by introspection**: `spirit.js` knows where a family's `data.js` lives, so a page finds it by the family's
   name alone.
7. **No other way** (Andy, the box: *"anything not using the new spiritData.js and it's buddies clientCacheManager.js
   must do so in this item. no exceptions."*, and *"any notion that there is an alternative approach must disappear
   from all documentation and all comments and all code and tests in the entire repo."*):
   - no client file (under `shell/`, `spirit/element/` or `spirit/app/`, but `shell/boot.js`, the face's own transport)
     takes the node's stream itself (`event.subscribe`): only `spirit/data.js` takes it, for every client. Those paths
     are the test's; `boot.js` and `seal.js` have been in `spirit/shell/` since goal/G43.18, which the list does not
     reach, so `spirit/shell/seal.js` is not judged; the apps left in `shell/` are, and every app of `spirit/app/`,
     where the apps and the servers moved (goal/G43.20);
   - no file of the repo (`.js`, `.md`, `.html`, `.json`; Andy's vault aside) names a
     replaced way: a page or client that runs `uncached`, the desk's two-level
     branches (`deskItem/`, `deskItems/`, `deskState/`), `D.data.<branch>`. The list names the ways replaced so far;
     any other notion is read for by hand.

8. **A branch's watch is called `watch`** (Andy, goal/G43.32: *"that's a decision: a BRANCHE's what is called
   "watch""*, *"the branch is already implied in it's containing object."*, *"wsl, assert this in a test for
   branches."*): every object a family's reads hold (`spirit.data.<name>.data`, and each object inside it) is a branch.
   - Its watch is the member named `watch`, and no member is named `watch` and more (`watchFile`, `watchApp`, `watchRow`
     are the names it replaces). Each family is its own check.
   - A watch is never told its branch, the object it sits on: it takes the function and at most the row it narrows to,
     `watch(fn)` or `watch(id, fn)`, so no more than two parameters.

**Nobody adds a family past these rules** (Andy, goal/G43.32: *"make sure nobody can add an app implementing a family,
without adhering to the rules, this means that a test outside of each branch must assert this."*): this test lives
outside every branch, in `spirit/test/`, and finds the families itself. Its tree is every file git keeps and every file
not yet added that git does not ignore, so a new app's `api.js` and `data.js` are judged by 1 to 8 before they are
committed.

### What its test must try to break

- A data set loaded from somewhere else by node than by the page; a cache taken from somewhere else than the family's
  own `data.js`.
- A manager that does one thing in node and another in a page.
- A module writing a cache file besides appServer.
- A client taking the node's stream itself; a file naming a replaced way.

## The families part: every family at spirit.data.<name>

The end state of goal/G43.7: every family at `spirit.data.<name>`, through `spirit/data.js`. Its test, once `./data-families.js`, is a section of `./data.js`. Each family is checked on its own, so the count of what is owed falls as each one moves.

Andy, box: *"we rename it spirit/data.js and it IS the the spirit.data object."*

### Requirements

Each family's own (its `data.js` there, the old file gone, none of it rolled by hand, `data` and `cache` in node and
on a page) is judged on each branch folder by `./spirit-sibling-branchRules.js` since goal/G43.32. Here, what judges
no one branch: one helper for all, no old names in the code, the shape of `spirit.data` and `spirit.app`, the cache by
node, the reads moved.

- `spirit/data.js` stands and the old module is gone.
- All the families, Andy: *"yes, of course all 19"* (18 since fileServer went with run://process, goal/G43.20): each has a `data.js`, a node family at `spirit/<name>/data.js`, a server at `spirit/app/<name>/data.js` (chatClerver's in `spirit/app/chat/`), and the old file is gone.
- *"with the SAME pattern"*: each `data.js` calls one and the same helper of `spirit.data` with the family's own name, and rolls no guard, no attach and no write on `spirit` of its own.
- *"instead of spirit.<name>Data"*: no code in the run tree reads a `spirit.<name>Data`, or names the old file or module. Comments are not judged, since a comment may quote Andy.
- On a page, the first level of `spirit` holds no `<name>Data`.
- *"spirit.data.<name>.data"* and *"spirit.data.<name>.cache"* stand for each family, under its own name (Q1), so `spirit.data.chat` and `spirit.data.deskVerify`. All 18 are judged in node (fileServer went with run://process, goal/G43.20), and on a page all but `agent`, `chat` and `deskClient`, which a scratch node does not offer to a page.
- *"this object has only helper functions and object <name> for every application"*: nothing else is on `spirit.data`, so the shared tree `spirit.data.data` is gone.
- Every helper on `spirit.data` has a capital in its name, Andy: *"all the helperFunctions in objects like spirit.data should potential \"words\" the should have a capital in it"*, and on Q10: *"it belongs to \"Fix 'data'\", THIS item."* A word is a to z, so no family can land on a helper.
- Q5, *"Does spirit.data.<name>.cache hold a level per node, as the tree does today?"*, Andy: *"yes."* The app rows stand at `spirit.data.app.cache[<node>].apps`, and a row of another node stands under that node and not under this page's.
- On `spirit.app`, Andy: *"the helpes must not be words there either, this goes for all spirit.app contained objects."* No function on it, or on an app it holds, is a word. `FS` is left out: it is every family's, and an app cannot land inside it.
- The reads moved: `spirit.data.app.data` answers `rows` and `watch`, and `spirit.data.fs.data.watch` stands, which `word.js` follows.

### Assumed by this test

The box names no helper, so the test finds it by its call: a function called with the family's name as a string. A row of another node is written through `spirit.data.viewAt(node, family)`, and the page node comes from `spirit.data.homeNode()`, the builder's names.
