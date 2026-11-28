# The test reach rules module

goal/G49.27, step 2a. Its test is `./script.js`; the module is `../script.js`, the part `testReachRules` of `spirit/test/script-sibling-general.js` moved into a rule module.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- It applies to a production script and to no file in a test folder.
- On a planted run, a script that requires only a sibling keeps *"no production module loads or requires a test file"*; one that requires a file of its test folder is red on it.
