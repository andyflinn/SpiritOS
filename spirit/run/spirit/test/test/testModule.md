# The general rules judge the product modules

goal/G43.23, item 4. Its test is `./testModule.js`: `testsFor()` of `../testModule.js` on this tree, read only, for `spirit/apiDoor.js`, a product module under `spirit/run/spirit/` with its own test.

The box: *"the general rules judge no module: testModule.js looks for ./spirit.js."*

## Requirements

- On the blast radius of a product module under `spirit/run/spirit/`, each general rule test of `spirit/test/`, beside `spirit/spirit.js` since goal/G43.32 (`spirit/test/spirit-child-generalRules.js`, `spirit/test/spirit-sibling-generalRules.js`, `spirit/test/spirit-sibling-searchRules.js`, `spirit/test/spirit-sibling-testReachRules.js`), is listed once with that module as the file it judges.
- On the whole list (`testsFor('')`), each of those general rule tests judges modules, that module among them.
- **The tools of `spirit/test/`** (goal/G43.32, Q2): `testReport.js`, `testModule.js` and `headLessChrome.js` are tools, not tests: no entry of the whole list is one of them, and none is judged as a module; their own tests in `spirit/test/test/` are listed.
- **A module's tests by name** (goal/G43.27; Andy: *"every test must be directly (by name) or indirectly (by general
  rule) be associated with a production file"*): on its blast radius, `./test/<name>-<what>.js` runs once with
  `./<name>.js`, never with another module of the folder; a module below runs those of the module above it, as it runs
  that module's own test. Judged on `spirit/server.js` and `./server-garbage.js` (`spirit/apiDoor.js`'s test by name
  went into the branch rules in goal/G43.32).
- **The branch rules judge each branch folder once** (goal/G43.32; Andy: *"app-branches are easily identified using the
  patterns: spirit/app/<name>/<name>.js, spirit/app/<name>/<name>.json"*, *"and system branches by: spirit.<name>.api.js
  && spirit.<name>.data.js"*, to Q7: *"branch test only needs to associate a failure with either spirit/<name>/ or
  spirit/app/<name>/"*): `branchesOf()` reads the branch folders by both patterns, as the disc holds them
  (`spirit/app/test/` and `spirit/test/` are none; an app branch by its manifest alone since goal/G43.32); on the whole list `spirit-sibling-branchRules.js` has one entry
  per branch folder; on `spirit/app/desk/desk.js`'s blast radius, the one branch holding it, `spirit/app/desk`, not
  `spirit/app`; a module in no branch (`spirit/apiAuth.js`) gets none. It is apart from the general rule tests above,
  which judge modules.
