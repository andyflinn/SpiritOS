# The module rules module

goal/G49.27. Its test is `./script.js`; the module is `../script.js`, its checks moved from the one general rules module (spirit/testicle/general/any/generalRules/script.js, split by topic: *"the 191 checks of today's general file are split by topic into such modules; a new standard is a new folder, not a longer file"*).

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`; and `codeOf` and `moduleRulesAt`, which the other rule modules ask: `codeOf(src, true)` blanks a string's insides and a comment, every offset kept; `moduleRulesAt(run, file)` reads a module of that run.
- On a planted run, a product script with `'use strict'` that takes spirit first keeps *"it starts with 'use strict', takes spirit first, and loads the tree only through spirit.requireScript"*; one that starts with a plain require is red on it. Only that title's body runs.
- **The runner judging the module rules in a scratch tree** (goal/G47.1; moved from the general rules' own test): a scratch copy of the tracked files of spirit/run, in a git index of its own; `spirit/testicle/run/none/script.js` runs there as its own process, this module alone, handed one script. Handed `spirit/script.js`, *"it sets the global spirit before its first require"* is green; handed a planted `spirit/zzGarbage/late.js` that requires `fs` before `spirit.js` (Andy: *"11. is script-sibling-general"*), *"it requires spirit.js first"* is red, under that script.
