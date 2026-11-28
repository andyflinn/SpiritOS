# The garbage rules module

goal/G49.27, step 2a. Its test is `./script.js`; the module is `../script.js`, the part `noFuckingGarbage` of `spirit/test/script-sibling-general.js` moved into a rule module.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- On a planted run, a module's `test/script.js`, its `test/script.md` beside it, keeps *"every file in a test folder matches a production file: none is garbage"*; a test named after no module beside its folder is red on it.

## The runner judging the garbage rule in a scratch tree

goal/G47.1, the cycle "missing tests reported"; folded here from `spirit/test/test/spirit-sibling-general.js` (goal/G49.27: one test file per module). The box: *"script-sibling-noFuckingGarbage also reports missing tests, in one check, "every production script has its own test", severity 0.2: red while any production script has no own test, test/<name>.js beside it, its answer naming every script missing one. Over the whole tree (handed nothing, or spirit.js) it judges every production script; handed one script, that one, by the same check. One check, not one per script"*, and *"Vendored scripts are left out of the check"*.

A scratch copy of the tracked files of spirit/run, in a git index of its own, with planted scripts: `spirit/zzGarbage/has.js` with `test/has.js` and its `.md`, `spirit/zzGarbage/lacks.js` with no test, and `spirit/element/codeMirror/zzVendored.js` in a vendored folder with no test. `spirit/test/script-sibling-general.js` runs there as its own process; with no environment.json its reporter reports to no node.

- This module (`../script.js`) holds the check `every production script has its own test` at severity 0.2.
- Over the whole tree, with a script missing its own test, the check is red.
- Handed spirit.js, it judges the whole tree the same.
- Handed a script with its own test, the check is green; handed one with none, it is red, under that script.
