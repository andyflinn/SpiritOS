# The general rules module

goal/G49.27, step 2a. Its test is `./script.js`; the module is `../script.js`, the part `generalRules` of `spirit/test/script-sibling-general.js` (its tree rules with it) moved into a rule module.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `node`, own `false` (its node checks use the run's one shared scratch node).
- On a planted run, a product script with `'use strict'` that takes spirit first keeps *"it starts with 'use strict', takes spirit first, and loads the tree only through spirit.requireScript"*; one that starts with a plain require is red on it. Only that title's body runs, so no node is started.

## The runner judging the general rules in a scratch tree

goal/G47.1; folded here from `spirit/test/test/spirit-sibling-general.js` (goal/G49.27: one test file per module). A scratch copy of the tracked files of spirit/run, in a git index of its own, with the planted scripts below; `spirit/test/script-sibling-general.js` runs there as its own process, handed one planted script, and the verdict of one of this module's titles is read from what it prints.

### The module rule

Moved from `spirit/test/script.js` (Andy: *"11. is script-sibling-general"*). A planted `spirit/zzGarbage/late.js` requires `fs` before `spirit.js`.

- Handed `spirit/script.js`, "it sets the global spirit before its first require" is green.
- Handed `late.js`, "it requires spirit.js first" is red, under that script.

### What it changes, it listens for, through a child on a branch

wsl, of the model table: *"the list it mounts ... is what shows the result, so it does listen, through its child"*; cw: *"A child it mounts on a branch counts as its listening"*. Three planted elements in `spirit/element/zzListen/`: `child.js`, which loads the search element and makes its search on a branch worked out from the name it is handed; `writer.js`, which writes, requires `child.js` and hands it a branch by name; and `deaf.js`, which writes and has no watch, no search and no child.

- Handed `writer.js`, "it sends writes and watches the store" is green.
- Handed `deaf.js`, the same check is red.

### Nothing on the global object or on process but spirit

Andy: *"no developer will want to use a system that pollutes global name-spaces."*, *"go on this"*. Two planted node scripts in `spirit/zzGlobal/`: `leaky.js`, which assigns `global.zzLeaked`, and `clean.js`, which hands out its value through `module.exports` alone. The runner is handed the scratch tree as its run, as testicle hands one (`SPIRIT_MOUNT_RUN`).

- Handed `leaky.js`, "loaded in a node, it adds nothing to the global object or to process but spirit" is red, under that script.
- Handed `clean.js`, the same check is green.

### No temp path of its own

The box: *"nothing else builds a temp path"*. A planted `spirit/zzGlobal/ownTemp.js` calls the system temp folder itself.

- Handed `ownTemp.js`, "it builds no temp path of its own: its temp folder comes from spirit/tempFolder/script.js" is red, under that script.
- Handed `clean.js`, the same check is green.
