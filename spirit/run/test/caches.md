# caches.js

Every family's cache, one code in the browser and in node (goal/G41.28). Not a test of one module: of the api tree's
families, and the two places their caches run, a page and a server process that follows a stream (appServer). Its test
is `./caches.js`.

Andy, on G41.28: *"WSL, make sure you assert that every family in the api tree HAS a clientCacheManager, AND the a
node.js Process like DeskClient uses the Exact same code as the browser for the cache management. The only difference
is the appServer serializes the cache to disk."*

## Requirements

1. **Every family in the api tree has a data.js**: each family's interface, `process/js/<name>/family/api.js`
   (`spirit.familyPath`) and the node's own `spirit/<name>/api.js`, has `data.js` in its own folder, `process/js/<name>/` or `spirit/<name>/`. Each family
   is its own check, named by the family. An app of `spirit/app/<name>/` (interface `./api.js` beside `<name>.js`, goal/G43.27; the
   agent app today) matches neither pattern and is not counted.
2. **One code**:
   - the data set is one file, `spirit/data.js`: `spirit.js` brings it to a page, appServer requires the
     same file;
   - appServer takes a family's cache from the family's own `data.js`;
   - a manager's branches (the names it gives `var` constants, `var ITEMS = 'desk'`) are named by it alone: no other
     file hands a path of them to a `spirit.data` reader or writer (`D.get('desk/' + id)`). Every other file asks the
     manager.
3. **The same rows make the same cache**: the desk's `data.js` and the data set, run in node as appServer
   runs them (required, on the process's global) and in a page's window as a page runs them (plain scripts,
   no module), are told the same serving node (`homeNode(key)`, a key holding a `+` and a `/`) and handed the same rows (two
   goal pushes, an item as a JSON string, a rule), and end with the same `spirit.data.desk.cache`. Its top level is that node
   alone, its key in base64url (Q5 of goal/G43.7: *"yes."*).
4. **The one difference is the disk**: no `data.js` requires `fs` or `path`, writes or reads a file, or
   uses the browser's storage; appServer writes each sender's cache to its own file; no other module writes a cache
   file of its own.

5. **One contract**: every `data.js` stands through `spirit.data.makeFamily`, required or loaded, so its reads are at
   `spirit.data.<name>.data`, for clients to ask. Its cache rules (`cache`, an object) are exported where its
   family's clients keep a cache file, for appServer.
6. **Found and downloaded by introspection** (Andy, on G41.28: *"We're not done until every family of the API tree as a
   clientCacheManager, and clients can use that to organize their spirit.data, and the shell can introspect to find and
   download their clientCacheManagers."*):
   - `spirit.js` knows where a family's `data.js` lives, so a page finds it by the family's name alone;
   - for every family the node's own api tree names (a scratch node, `api`), the shell finds its manager by the folder
     shape, as `spirit.cacheManager` does (goal/G43.27): `spirit/app/<name>/data.js` for an app, `spirit/<name>/data.js`
     for a node family; no family's FS is asked. The node serves it as a script that calls `spirit.data.makeFamily`. Each family is its own check. The scratch node runs no app server, so its tree names the node's own families and the file server;
     every family the tree holds is asked in 1.

7. **No other way** (Andy, the box: *"anything not using the new spiritData.js and it's buddies clientCacheManager.js
   must do so in this item. no exceptions."*, and *"any notion that there is an alternative approach must disappear
   from all documentation and all comments and all code and tests in the entire repo."*):
   - no client file (under `shell/`, `spirit/element/` or `process/js/`, but `shell/boot.js`, the face's own transport)
     takes the node's stream itself (`events.subscribe`): only `spirit/data.js` takes it, for every client. Those paths
     are the test's; `boot.js` and `seal.js` have been in `spirit/shell/` since goal/G43.18, which the list does not
     reach, so `spirit/shell/seal.js` is not judged; the apps left in `shell/` are, and none of `spirit/app/`, where
     the apps moved, is;
   - no file of the repo (`.js`, `.md`, `.html`, `.json`; the desk's `currentGoal.json` and Andy's vault aside) names a
     replaced way: a page or client that runs `uncached`, the desk's two-level
     branches (`deskItem/`, `deskItems/`, `deskState/`), `D.data.<branch>`. The list names the ways replaced so far;
     any other notion is read for by hand.

## What its test must try to break

- A family without a data.js.
- A data set or a manager loaded from somewhere else by node than by the page.
- A file other than the manager naming one of its branches.
- A manager that does one thing in node and another in a page.
- A manager that keeps its cache itself, on disk or in browser storage; a module writing a cache file besides appServer.
- A manager without the contract; a page that cannot find a family's manager by its name; a manager the node does not
  serve.
