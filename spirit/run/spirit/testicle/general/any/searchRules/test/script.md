# The search rules module

goal/G49.27, step 2a. Its test is `./script.js`; the module is `../script.js`, the part `searchRules` of `spirit/test/script-sibling-general.js` moved into a rule module.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- On a planted run, a script that hands its search the row keeps *"it hands every search the row whole"*; one that hands it an object of fields picked by hand is red on it.
