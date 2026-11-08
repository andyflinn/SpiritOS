# The general rules judge the product modules

goal/G43.23, item 4. Its test is `./testModule.js`: `testsFor()` of `../testModule.js` on this tree, read only, for `spirit/apiDoor.js`, a product module under `spirit/run/spirit/` with its own test.

The box: *"the general rules judge no module: testModule.js looks for ./spirit.js."*

## Requirements

- On the blast radius of a product module under `spirit/run/spirit/`, each general rule test of the run root (`test/spirit-child-generalRules.js`, `test/spirit-sibling-generalRules.js`, `test/spirit-sibling-searchRules.js`, `test/spirit-sibling-testReachRules.js`) is listed once with that module as the file it judges.
- On the whole list (`testsFor('')`), each of those general rule tests judges modules, that module among them.
- **A module's tests by name** (goal/G43.27; Andy: *"every test must be directly (by name) or indirectly (by general
  rule) be associated with a production file"*): on its blast radius, `./test/<name>-<what>.js` runs once with
  `./<name>.js`, never with another module of the folder; a module below runs those of the module above it, as it runs
  that module's own test.
