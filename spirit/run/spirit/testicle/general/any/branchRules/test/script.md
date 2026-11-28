# The branch rules module

goal/G49.27, step 2a. Its test is `./script.js`; the module is `../script.js`, the part `branchRules` of `spirit/test/script-sibling-general.js` moved into a rule module.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `node`, own `false` (it uses the run's one shared scratch node).
- The planted run is a git tree, since the module reads the tree from git.
- On it, an app branch whose manifest has no `kind` or `operated` keeps *"its manifest has no kind or operated: the node operates the server"*; one whose manifest names a `kind` is red on it. Neither has an `api.js`, so no node is asked.
