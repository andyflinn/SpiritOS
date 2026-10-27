# shell/js/apiBranchSelector.js

The api-branch selector (apiAuth/G1.9; goal/G41.5): one shell element, the server dropdown and the verb dropdown side
by side. Grants and introSpector use it.

## Requirements

- **Built on probabilitySearch**: its server half is the app-server selector, its verb half the verb dropdown, apiVerbSelector (each a shell element with its own test folder);
  nothing of `shellCreateListSearch` (goal/G40.8).
- **It loads what it uses itself** (goal/G41.3): `shell/js/appServerSelector.js` and `shell/js/apiVerbSelector.js`.
- `createApiBranchSelector({ all, serverPlaceholder, tree })` answers its root: `root.server` (the chosen server, `''`
  for none), `root.verb` (`''` when none or all verbs), and `root.value`, the path a grant takes: `''` with no server,
  `server` with no single verb, `server.verb` with one. Every change fires one bubbling `change`.
- The verb half hides until a server is chosen; its rows are `apiTreeIndex.verbs(tree, server)`, so DEBUG and
  DEPENDENCIES are never offered. Its None means all verbs.
- `root.load(fn)` lists another party's tree, clears the choice and hides the verb half.

## What its test must try to break

- An old shell list made, or a component not loaded by itself.
- The verb half shown before a server is chosen.
- DEBUG offered as a verb.
- A wrong value after a server pick, a verb pick, or all verbs.
- load leaving the old choice.
