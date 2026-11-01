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

## What its test must try to break

- A family without a clientCacheManager.js.
- A data set or a manager loaded from somewhere else by node than by the page.
- A file other than the manager naming one of its branches.
- A manager that does one thing in node and another in a page.
- A manager that keeps its cache itself, on disk or in browser storage; a module writing a cache file besides appServer.
