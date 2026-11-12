# spirit/test/test/spirit-sibling-noFuckingGarbage.js

The tests of `spirit/test/spirit-sibling-noFuckingGarbage.js`, the garbage rule, and of no other module.

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
