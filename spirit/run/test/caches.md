# caches.js

Every family's cache, one code in the browser and in node (goal/G41.28). Not a test of one module: of the api tree's
families, and the two places their caches run, a page and a server process that follows a stream (appServer). Its test
is `./caches.js`.

Andy, on G41.28: *"WSL, make sure you assert that every family in the api tree HAS a clientCacheManager, AND the a
node.js Process like DeskClient uses the Exact same code as the browser for the cache management. The only difference
is the appServer serializes the cache to disk."*

## Requirements

1. **Every family in the api tree has a clientCacheManager**: each family's interface, `process/js/<name>/family/api.js`
   (`spirit.familyPath`) and the node's own `spirit/<name>/api.js`, has `clientCacheManager.js` beside it. Each family
   is its own check, named by the family.
2. **One code**:
   - the data set is one file, `shell/shared/js/spiritData.js`: `spirit.js` brings it to a page, appServer requires the
     same file;
   - appServer takes a family's cache from the family's own `clientCacheManager.js`, beside its api.js;
   - a manager's branches (the names it gives `var` constants, `var ITEMS = 'desk'`) are named by it alone: no other
     file hands a path of them to a `spirit.data` reader or writer (`D.get('desk/' + id)`). Every other file asks the
     manager.
3. **The same rows make the same cache**: the desk's `clientCacheManager.js` and the data set, run in node as appServer
   runs them (required, attached to the process's global) and in a page's window as a page runs them (plain scripts,
   no module), are handed the same rows (two goal pushes, an item as a JSON string, a rule) and end with the same
   `spirit.data`.
4. **The one difference is the disk**: no `clientCacheManager.js` requires `fs` or `path`, writes or reads a file, or
   uses the browser's storage; appServer writes each sender's cache to its own file; no other module writes a cache
   file of its own.

5. **One contract**: every `clientCacheManager.js` exports `{ cache, attach }`, and attached it puts its reader on
   `spirit`, for clients to ask (as the desk's puts `spirit.deskData`).
6. **Found and downloaded by introspection** (Andy, on G41.28: *"We're not done until every family of the API tree as a
   clientCacheManager, and clients can use that to organize their spirit.data, and the shell can introspect to find and
   download their clientCacheManagers."*):
   - `spirit.js` knows where a family's `clientCacheManager.js` lives, so a page finds it by the family's name alone;
   - for every family the node's own api tree names (a scratch node, `api`), the node answers that family's manager,
     beside its interface (`process/js/<name>/family/` or `spirit/<name>/`), as a script with an `attach`. Each family is
     its own check. The scratch node runs no app server, so its tree names the node's own families and the file server;
     every family the tree holds is asked in 1.

## What its test must try to break

- A family without a clientCacheManager.js.
- A data set or a manager loaded from somewhere else by node than by the page.
- A file other than the manager naming one of its branches.
- A manager that does one thing in node and another in a page.
- A manager that keeps its cache itself, on disk or in browser storage; a module writing a cache file besides appServer.
- A manager without the contract; a page that cannot find a family's manager by its name; a manager the node does not
  serve.
