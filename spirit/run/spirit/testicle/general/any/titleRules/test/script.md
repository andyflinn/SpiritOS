# The title rules module

goal/G49.27, step 2a. Its test is `./script.js`; the module is `../script.js`, the part `titleRules` of `spirit/test/script-sibling-general.js` moved into a rule module.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- The planted run is a git tree, since the module reads its suites from git.
- On it, a suite whose titles are plain strings keeps *"every title is one plain string, nothing built into it"*; a suite with a title built at run time is red on it.
