# The garbage rules module

goal/G49.27, step 2a. Its test is `./script.js`; the module is `../script.js`, the part `noFuckingGarbage` of `spirit/test/script-sibling-general.js` moved into a rule module.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- On a planted run, a module's `test/script.js`, its `test/script.md` beside it, keeps *"every file in a test folder matches a production file: none is garbage"*; a test named after no module beside its folder is red on it.
