# deskVerify's data.js keeps no verifyTests branch

goal/G43.23, item 10 (after goal/G43.22). Its test is `./noVerifyTests.js`: the family loaded as a page's `spirit.data` holds it, and `../data.js` read with its comments left out.

The box: *"plugin leftovers (G43.22): deskChat.js and deskElement.js in shell/shared, loaded by nothing; deskVerify's data.js keeps a verifyTests branch."*

## Requirements

- The deskVerify family's reads offer no tests branch (no `testsBranch`).
- `process/js/deskVerify/data.js`'s code names no `verifyTests` branch.
- The world: the family loads with its `state` and `flips` reads, and its code still names `verifyFlips`.
