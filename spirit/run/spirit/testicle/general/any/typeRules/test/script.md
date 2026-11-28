# The type rules module

goal/G49.27, step 2a. Its test is `./script.js`; the module is `../script.js`, the part `typeRules` of `spirit/test/script-sibling-general.js` moved into a rule module.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- It applies to a type file under `spirit/type/` and to no script outside it.
- On a planted run, a type file whose `isValid` throws for `null` and `undefined` keeps *"for every type file, isValid throws an error for null and for undefined"*; one whose `isValid` answers `false` for `null` is red on it.
- **A module's own forbidden name is skipped, only in its own files** (goal/G49.27; Andy: *"All, cw's way"*): on a planted git tree, a rule module that names `spirit.type.string.line` and hands it out as its forbids keeps *"no script of the tree names spirit.type.string.line or spirit.type.string.lineSelect"*; the same name in a script outside that module is red on it.
