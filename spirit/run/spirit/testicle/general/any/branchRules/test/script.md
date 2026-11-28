# The branch rules module

goal/G49.27, step 2a. Its test is `./script.js`; the module is `../script.js`, the part `branchRules` of `spirit/test/script-sibling-general.js` moved into a rule module.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `node`, own `false` (it uses the run's one shared scratch node).
- The planted run is a git tree, since the module reads the tree from git.
- On it, an app branch whose manifest has no `kind` or `operated` keeps *"its manifest has no kind or operated: the node operates the server"*; one whose manifest names a `kind` is red on it. Neither has an `api.js`, so no node is asked.

## The branch part uses the node its run is handed

goal/G47.1; folded here from `spirit/test/test/spirit-sibling-general.js` (goal/G49.27: one test file per module). It runs the runner, `spirit/test/script-sibling-general.js`, and stands here because the part being run is this module's. Andy: *"are the tests not ordered in the general test so that all tests requiring a scratch node can use the same one?"*, then *"fix it, with red and code"*. Handed a list, the runner runs every part once a script; its branch part booted a node of its own for each.

The runner is run on `spirit/app/backup/api.js` and `spirit/app/chat/api.js`, handed a node as testicle hands one (`SPIRIT_MOUNT_BASE`, `SPIRIT_MOUNT_RUN`): an address in front of a real scratch node that counts what reaches it.

- The scratch node of each script's run comes up.
- Each script uses the node it is handed, so calls naming `spirit.app.backup` and calls naming `spirit.app.chat` both reach it.
