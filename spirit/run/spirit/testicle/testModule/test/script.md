# The general rules judge the product modules

goal/G43.23, item 4. Its test is `./script.js`: `testsFor()` of `../script.js` on this tree, read only, for `spirit/peer/door/script.js`, a product module under `spirit/run/spirit/` with its own test.

The box: *"the general rules judge no module: testModule.js looks for ./spirit.js."*

## Requirements

- **One runner per resource** (goal/G49.27, step 3, the box: *"one runner per resource starts it once and runs every module
  needing it"*): the general tests of the whole tree are `spirit/testicle/run/none/script.js`, `node/script.js` and
  `browser/script.js`, and `spirit/test/` holds no general test any more. On the blast radius of a product module under
  `spirit/run/spirit/`, each is listed once with that module as the file it judges.
- On the whole list (`testsFor('')`), each of those general rule tests judges modules, that module among them.
- **No opting in** (goal/G47.1; Andy: *"all general test will auto-opt in ANY applicable file."*): on a planted tree of
  its own, a general test judges every module in its reach, one with no test of its own among them, on the whole list and
  on that module's blast radius.
- **The tools of the test system** (goal/G43.32, Q2; goal/G49.27): `spirit/testicle/testReport/`, `testModule/` and `headLessChrome/` are tools, not tests: no entry of the whole list is one of them, and none is judged as a module; their own tests at `spirit/testicle/<name>/test/script.js` are listed.
- **One test file per script** (goal/G45.1, `../../../test/TEST_SYSTEM.md`): on a planted tree of its own, a script's
  `./test/<name>.js` runs with it and with the scripts below it, and no `./test/<name>-<what>.js` is read, on its own
  script or below it.
- **The branch rules judge a script's branch from the script** (goal/G47.1, box v94, 2; their module
  `spirit/testicle/general/any/branchRules/script.js`, run by the node runner): no entry of the whole list hands a general test a
  branch folder (`branchesOf()` reads twenty or more); on `spirit/app/desk/desk.js`'s blast radius the node runner judges
  `desk.js` itself.
- **The special general tests** (goal/G47.1, box v94, 1): `spirit/testicle/scriptClassify/script.js` is listed as no test and handed no
  module; testicle runs it itself.
