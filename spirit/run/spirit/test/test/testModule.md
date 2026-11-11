# The general rules judge the product modules

goal/G43.23, item 4. Its test is `./testModule.js`: `testsFor()` of `../testModule.js` on this tree, read only, for `spirit/apiDoor.js`, a product module under `spirit/run/spirit/` with its own test.

The box: *"the general rules judge no module: testModule.js looks for ./spirit.js."*

## Requirements

- On the blast radius of a product module under `spirit/run/spirit/`, each general rule test of `spirit/test/`, beside `spirit/spirit.js` since goal/G43.32 (`spirit/test/spirit-sibling-generalRules.js`, which holds the module rules once in `spirit-child-generalRules.js` since goal/G47.1, `spirit/test/spirit-sibling-searchRules.js`, `spirit/test/spirit-sibling-testReachRules.js`, `spirit/test/spirit-sibling-titleRules.js`), is listed once with that module as the file it judges.
- On the whole list (`testsFor('')`), each of those general rule tests judges modules, that module among them.
- **No opting in** (goal/G47.1; Andy: *"all general test will auto-opt in ANY applicable file."*): on a planted tree of
  its own, a general test judges every module in its reach, one with no test of its own among them, on the whole list and
  on that module's blast radius.
- **The tools of `spirit/test/`** (goal/G43.32, Q2): `testReport.js`, `testModule.js` and `headLessChrome.js` are tools, not tests: no entry of the whole list is one of them, and none is judged as a module; their own tests in `spirit/test/test/` are listed.
- **One test file per script** (goal/G45.1, `../TEST_SYSTEM.md`): on a planted tree of its own, a script's
  `./test/<name>.js` runs with it and with the scripts below it, and no `./test/<name>-<what>.js` is read, on its own
  script or below it.
- **The branch rules judge each branch folder once** (goal/G43.32; Andy: *"app-branches are easily identified using the
  patterns: spirit/app/<name>/<name>.js, spirit/app/<name>/<name>.json"*, *"and system branches by: spirit.<name>.api.js
  && spirit.<name>.data.js"*, to Q7: *"branch test only needs to associate a failure with either spirit/<name>/ or
  spirit/app/<name>/"*): `branchesOf()` reads the branch folders by both patterns, as the disc holds them
  (`spirit/app/test/` and `spirit/test/` are none; an app branch by its manifest alone since goal/G43.32); on the whole list `spirit-sibling-branchRules.js` has one entry
  per branch folder; on `spirit/app/desk/desk.js`'s blast radius, the one branch holding it, `spirit/app/desk`, not
  `spirit/app`; a module in no branch (`spirit/apiAuth.js`) gets none. It is apart from the general rule tests above,
  which judge modules.
