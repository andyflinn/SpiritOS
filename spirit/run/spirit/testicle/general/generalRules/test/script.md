# The general rules module

goal/G49.27, step 2a. Its test is `./script.js`; the module is `../script.js`, the part `generalRules` of `spirit/test/script-sibling-general.js` (its tree rules with it) moved into a rule module.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `node`, own `false` (its node checks use the run's one shared scratch node).
- On a planted run, a product script with `'use strict'` that takes spirit first keeps *"it starts with 'use strict', takes spirit first, and loads the tree only through spirit.requireScript"*; one that starts with a plain require is red on it. Only that title's body runs, so no node is started.
