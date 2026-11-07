# The general rules judge the product modules

goal/G43.23, item 4. Its test is `./testModule.js`: `testsFor()` of `../testModule.js` on this tree, read only, for `spirit/apiDoor.js`, a product module under `spirit/run/spirit/` with its own test.

The box: *"the general rules judge no module: testModule.js looks for ./spirit.js."*

## Requirements

- On the blast radius of a product module under `spirit/run/spirit/`, each general rule test of the run root (`test/spirit-child-generalRules.js`, `test/spirit-sibling-generalRules.js`, `test/spirit-sibling-searchRules.js`, `test/spirit-sibling-testReachRules.js`) is listed once with that module as the file it judges.
- On the whole list (`testsFor('')`), each of those general rule tests judges modules, that module among them.
