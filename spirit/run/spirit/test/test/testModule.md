# The general rules judge the product modules

goal/G43.23, item 4. Its test is `./testModule.js`: `testsFor()` of `../testModule.js` on this tree, read only, for `spirit/apiDoor.js`, a product module under `spirit/run/spirit/` with its own test.

The box: *"the general rules judge no module: testModule.js looks for ./spirit.js."*

## Requirements

- **Three kinds** (goal/G47.1, box v94, 2: *"there will be, from now on only 3 types of general tests, at any level of the
  tree: <file>-<child | sibling>-general.js, <file>-<child | sibling>-node.js, <file>-<child | sibling>-browser.js"*): the
  general tests of `spirit/test/` beside `spirit/spirit.js` are `spirit-sibling-general.js`, `spirit-sibling-node.js` and
  `spirit-sibling-browser.js`, and no other. On the blast radius of a product module under `spirit/run/spirit/`, each is
  listed once with that module as the file it judges.
- On the whole list (`testsFor('')`), each of those general rule tests judges modules, that module among them.
- **No opting in** (goal/G47.1; Andy: *"all general test will auto-opt in ANY applicable file."*): on a planted tree of
  its own, a general test judges every module in its reach, one with no test of its own among them, on the whole list and
  on that module's blast radius.
- **The tools of `spirit/test/`** (goal/G43.32, Q2): `testReport.js`, `testModule.js` and `headLessChrome.js` are tools, not tests: no entry of the whole list is one of them, and none is judged as a module; their own tests in `spirit/test/test/` are listed.
- **One test file per script** (goal/G45.1, `../TEST_SYSTEM.md`): on a planted tree of its own, a script's
  `./test/<name>.js` runs with it and with the scripts below it, and no `./test/<name>-<what>.js` is read, on its own
  script or below it.
- **The branch rules judge a script's branch from the script** (goal/G47.1, box v94, 2: they are a part of
  `spirit-sibling-general.js`): no entry of the whole list hands a general test a branch folder (`branchesOf()` reads twenty
  or more); on `spirit/app/desk/desk.js`'s blast radius `spirit-sibling-general.js` judges `desk.js` itself.
- **The special general tests** (goal/G47.1, box v94, 1): `spirit/test/scriptClassify.js` is listed as no test and handed no
  module; testicle runs it itself.
