# spirit/test/test/spirit-sibling-general.js

The tests of the garbage rule, the noFuckingGarbage part of `spirit/test/spirit-sibling-general.js` (goal/G47.1, box v94, 2:
the general tests folded into three), and of no other part.

## What it asserts (goal/G47.1, the cycle "missing tests reported")

The box: *"spirit-sibling-noFuckingGarbage also reports missing tests, in one check, "every production script has its own
test", severity 0.2: red while any production script has no own test, test/<name>.js beside it, its answer naming every
script missing one. Over the whole tree (handed nothing, or spirit.js) it judges every production script; handed one script,
that one, by the same check. One check, not one per script"*, and *"Vendored scripts are left out of the check"*.

- The rule holds the check `every production script has its own test` at severity 0.2.
- Over the whole tree, with a script missing its own test, the check is red; its answer names that script, no script that
  has its own test, and no vendored script.
- Handed spirit.js, it judges the whole tree the same.
- Handed a script with its own test, the check is green; handed one with none, it is red and names it.

## How it is tried

A scratch copy of the tracked files of spirit/run, in a git index of its own, with planted scripts: `spirit/zzGarbage/has.js`
with `test/has.js` and its `.md`, `spirit/zzGarbage/lacks.js` with no test, and `spirit/element/codeMirror/zzVendored.js` in
a vendored folder with no test. The rule runs there as its own process; with no environment.json its reporter reports to no
node.

## What would make it red

- No check of that title and severity in the rule.
- A whole-tree run that stays green with a script missing its test, or misses that script in its answer, or names a script
  that has its test, or a vendored one.
- A run handed one script that judges anything else, or not that script.

## The module rule, tried

Moved here from `spirit/test/spirit.js` (goal/G47.1; Andy: *"11. is spirit-sibling-general"*). In the same scratch tree, a planted `spirit/zzGarbage/late.js` requires `fs` before `spirit.js`.

- Handed `spirit/spirit.js`, the rule "it sets the global spirit before its first require" is green.
- Handed `late.js`, "it requires spirit.js first" is red, and its answer names the first require, `"fs"`.

## What it changes, it listens for, through a child on a branch

goal/G47.1. wsl, of the model table: *"the list it mounts ... is what shows the result, so it does listen, through its child"*; cw: *"A child it mounts on a branch counts as its listening"*. In the same scratch tree, three planted elements in `spirit/zzListen/`: `child.js`, which loads the search element and makes its search on a branch worked out from the name it is handed (`data: branchOf(o.table)`); `writer.js`, which writes, requires `child.js` and hands it a branch by name (`table: 'zz'`); and `deaf.js`, which writes and has no watch, no search and no child.

- Handed `writer.js`, "it sends writes and watches spirit.data" is green. Red on the rule before (it read only the element's own code).
- Handed `deaf.js`, the same check is red.

## The branch part uses the node its run is handed

goal/G47.1. Andy: *"are the tests not ordered in the general test so that all tests requiring a scratch node can use the same one?"*, then *"fix it, with red and code"*. Handed a list, the rule runs every part once a script; its branch part booted a node of its own for each.

The rule is run on `spirit/app/backup/api.js` and `spirit/app/chat/api.js`, handed a node as testicle hands one (`SPIRIT_MOUNT_BASE`, `SPIRIT_MOUNT_RUN`): an address in front of a real scratch node that counts what reaches it.

- The scratch node of each script's run comes up.
- Each script uses the node it is handed, so calls naming backup and calls naming chat both reach it. Red on the rule before f558fe34 (nothing reached it), and on a mutant that hands only the first script the node (backup only).

## Nothing on the global object or on process but spirit

goal/G47.1; Andy: *"no developer will want to use a system that pollutes global name-spaces."*, *"go on this"*. In the same scratch tree, two planted node scripts in `spirit/zzGlobal/`: `leaky.js`, which assigns `global.zzLeaked`, and `clean.js`, which hands out its value through `module.exports` alone. The rule is handed the scratch tree as its run, as testicle hands one (`SPIRIT_MOUNT_RUN`).

- Handed `leaky.js`, "loaded in a node, it adds nothing to the global object or to process but spirit" is red, under that script.
- Handed `clean.js`, the same check is green.
- Both red on the rule before, which had no such check.

## No temp path of its own

goal/G47.1, the box: *"nothing else builds a temp path"*. In the same scratch tree, a planted `spirit/zzGlobal/ownTemp.js` that calls the system temp folder itself.

- Handed `ownTemp.js`, "it builds no temp path of its own: its temp folder comes from spirit/tempFolder.js" is red, under that script.
- Handed `clean.js`, the same check is green.
- Both red on the rule before, which had no such check.
