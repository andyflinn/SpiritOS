# word.js

`spirit/run/spirit/word.js` tracks the namespace claims (goal/G43.4). Its test is `./word.js`.

Andy, box: *"i will track nameSpace claims."*

## Requirements

- A word is a string of `a` to `z`. Five are hard-coded: `spirit`, `app`, `element`, `contact`, `job`, *"(this may change)"*. When they change, so does `HARD` in the test.
- `check('path.in.words', 'word')` compares case-insensitively and answers the lower-case word, else null. It looks at the `word.json` of each level on its path below the root, and at the hard-coded words. It reads no `run://spirit/word.json`. It sees nothing lower down and nothing in another branch.
- A word an object inherits, like `constructor`, is not reserved. A missing `word.json` counts as empty. A `word.json` is an object of word to `true`.
- A changed `word.json` is seen by the next `check`.
- On a page `spirit.word.check` answers through a promise, since a page asks its node for each `word.json`, kept until the node's file stream says it changed; `spirit.word.changed(fn)` tells a listener when one does. `spirit/element/files/rowElement.js` paints from these; its test judges them.
- *"add() is conceptual AND WILL NOT BE IMPLEMENTED IN THIS ITEM."* `word.js` has no `add`.

## The tree

*"the test for word will go red if the word system and the tree contradict."* Held against this checkout, leaving out `test` folders and `state`:

- The same word defined twice along a path is red.
- A folder or file below the root named after a word reserved above it is red (*"a word 'abc' reservers any 'abc.js' or 'abc/' or 'abc.anything'"*).
- A hard-coded word without its folder or file at `spirit/`, or without its object on the browser's spirit object, is red. Andy answered cw's Q2 that this red holds the item, and his box says *"the red generated from this will point us toward the next steps in restructuring the namespace. live with it."*
- `spirit` is exempt: *"in tests it is exempt from discrepancy rules."*

## Red by design

This suite does not go fully green while a word has no home. After the build it must fail on exactly `job` and `element`, the first because the node has `jobs`, the second because the page has `elements`, and no others. `spirit/app/app` fails too until it is removed.
