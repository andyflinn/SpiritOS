# Desk moves to spirit/app/desk/

goal/G43.27, requirements 11-22, `spirit/run/spirit/app/test/api-deskMove.js`.

Andy:
- "if desk can become spirit/api/desk/ in the same item, leaving deskVerify and deskClient where they are, with minor modifications, then i'll give it a go."
- "yes, i meant: spirit/app/desk/"
- "desk is NOT intrinsic."
- "just throw desk elements into spirit/app/desk/element/"

The tree is read as it is. Desk runs on a scratch node, switched on with `app.active`, never on a live node. The tree before the move is commit 8baa09c3.

## Requirements

- **11. The server in `spirit/app/desk/`.** It holds desk.js, desk.json, api.js, data.js, cacheRules.js and all 37 verb files at its top.
  - `process/js/desk/` is gone.
  - `spirit/app/desk/` has no `family/` folder.
- **12. The tools move with it.** That is deskAgentEar.js, deskLoop.js, goalShare.js, currentGoal.json, deskBundles.json, rules.md and deskLoopManual.md. Its 18 product tests sit in `spirit/app/desk/test/`.
- **18 and 19. desk.json in the spirit/app form.**
  - It says `identity.intrinsic` false and `node.mount` true, and keeps goalRepo and goalPath.
  - goalPath's default is `spirit/run/spirit/app/desk/currentGoal.json`.
  - It says the state is in `spirit/state/desk/data/`.
  - `spirit/app/desk/desk.js` is not core (`fileWritable` true).
- **14. deskClient finds desk by its new place.**
  - It requires `spirit/app/desk/api.js` instead of `familyPath('desk')`.
  - It subscribes under a new stream module name.
- **21 and 13. Desk runs from its new place.** On the scratch node:
  - `app.active` desk is accepted, and `desk.items.search` lists items.
  - `desk.FS.path` names `spirit/app/desk/api.js`.
  - The node files desk's job under the very module name deskClient subscribes to.
  - desk.db is at `spirit/state/desk/data/desk.db`.
- **16 and 17. No tracked file names `process/js/desk`.** The two currentGoal.json files, which quote the boxes, are left out.
- **22. The desk faces in `spirit/app/desk/element/`.** Every file of shell/desk/ and shell/deskDetails/ is there, and both old folders are gone.

## Not judged here

- 15, the flag day: it happens on each node, outside the tree.
- commitCheck.js and its two suites (commitCheck, commitHooks) are gone with the git hooks (Andy, goal/G43.27: "all, just get rid of the fucking git hooks.").
- 20, the bundle and grants in node.db: they are a node's state, which no build of this item changes.
