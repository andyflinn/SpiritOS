# spirit/client/apiTreeIndex.js — its own test

The owner's api tree, read for choosing: the tree the verb api answers on `/api/spirit` (goal/G30.6), one branch per
server, `{ ok: false, ... }` for one that did not answer (Andy: *"that server will not be part of the apiTree"*). No DOM,
so the deciding is asserted in node; dual target, so it is loaded once more in a window of its own. Owed since the rule
*"every production script has its own test"* (goal/G47.1, box v72).

- `servers` (apiAuth/G1.8): the server names, sorted; a server that did not answer, or a branch that is a string, an
  array or null, is no server; no tree, an array or a string is none.
- `verbs` (apiAuth/G1.9): one server's verbs, sorted; `DEBUG` never offered (Andy: *"DEBUG/... are owner only and will
  never be offered to peerPost clients."*); an unknown or broken server has none.
- `serves` (apiAuth/G1.6): a server that answered, and a verb among its verbs, are served; a missing verb, a server
  gone or broken, `fs.DEBUG`, and no path are not. It only reports: the tree is unchanged after asking (Andy: *"we defer
  pruning to be triggered by the owners auth app"*).
- In a page, with no `require`: `window.spirit.apiTreeIndex`, the same three.

## What its test must try to break

A broken server listed; DEBUG offered or served as a grant; any verb of a live server served; an unsorted list; the
page load reaching for `require`.
