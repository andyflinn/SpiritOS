# word.js

`spirit/run/spirit/word.js` tracks the namespace claims (goal/G43.4). Its test is `./word.js`.

Andy, box: *"i will track nameSpace claims."*

## Requirements

- A word is a string of `a` to `z`. word.js hard-codes twelve: `spirit`, `api`, `app`, `contact`, `data`, `element`, `job`, `node`, `state`, `search`, `stream`, `test`, *"(this may change)"*. When they change, so does `HARD` in the test. It has not yet: the test's `HARD` still names the earlier seven, `spirit`, `app`, `data`, `element`, `identity`, `job`, `search`, so it expects `identity` to be hard-coded, which word.js no longer holds, and asks none of the five new words.
- `check('path.in.words', 'word')` compares case-insensitively and answers the lower-case word, else null. It looks at the `word.json` of each level on its path below the root, and at the hard-coded words. It reads no `run://spirit/word.json`. It sees nothing lower down and nothing in another branch.
- A word an object inherits, like `constructor`, is not reserved. A missing `word.json` counts as empty. A `word.json` is an object of word to `true`.
- A changed `word.json` is seen by the next `check`.
- On a page `spirit.word.check` answers through a promise, since a page asks its node for each `word.json`, kept until the node's file stream says it changed; `spirit.word.changed(fn)` tells a listener when one does. `spirit/element/search/file/rowElement.js` paints from these; its test judges them.
- **No ask for a `word.json` that is not there** (goal/G43.32; cw measured on Andy's node 1821 requests on opening Files,
  1818 of them 404, all `fs.load` of a `word.json`; Andy: *"wsl, add a test to test/word.js to make sure this won't
  happend again."*): on a page `word.js` asks only for a `word.json` the node's file list (`spirit.data.fs`) holds, and
  each of those once until the stream says it changed. The test plants `spirit/app/word.json` on a scratch node and makes
  80 checks along 8 paths: the planted word is found, no other `word.json` is asked for, and that one at most once.
- `add('path.in.words', 'word')`, Andy: *"all, implement add()"*, answers a boolean. *"add('spirit.app', 'activate') would add the 'activate' to "run://spirit/app/word.json"."* The word goes in with the value `true`, the words already in the file stay, and a level with no `word.json` yet gets one.
- `add` answers `false` and writes nothing on what is no word, on what `check` finds (*"no words can be added that already exists toward the root of the tree"*, and *"a boolean 'false' if the word already exists"*), and on a word a level below holds (Andy's yes to Q4). A word in another branch does not stop it. It also answers `false` on a path with no level `check` reads, such as `spirit`, on a path that is not in words, and on a `word.json` that is not an object of JSON, which it will not overwrite. No test holds these three yet.
- `add` makes no folder. Andy: *"wince fucking when does add() add a MOTHERFUCKING FOLDER?"* A level with no folder answers `false`. A path holds words, a to z, so a capital in it answers `false` too.
- `add` is in node only. Q5, *"Should add work from a page too, the way check does?"*, Andy: *"no."*

## The tree

*"the test for word will go red if the word system and the tree contradict."* Held against this checkout, leaving out `test` folders and `state`:

- The same word defined twice along a path is red.
- A folder or file below the root named after a word reserved above it is red (*"a word 'abc' reservers any 'abc.js' or 'abc/' or 'abc.anything'"*). A file that borrows from the word is no second definition, Q11: *"the word is defined ONCE, at the \"largest\" scope"*. Only `data` can show it today: its `data.js` calls `makeFamily`. A `data.js` that does not stays red.
- A hard-coded word without its folder or file at `spirit/`, or without its object on the browser's spirit object, is red. Andy answered cw's Q2 that this red holds the item, and his box says *"the red generated from this will point us toward the next steps in restructuring the namespace. live with it."*
- `spirit` is exempt: *"in tests it is exempt from discrepancy rules."*

## Red by design

This suite does not go fully green while a word has no home. It was written to fail on exactly `job`, because the node has `jobs`, and `identity`, which has no folder and no object yet, and no other. Since word.js's list changed (above) and the test's did not, that is no longer the whole of its red: `identity` is also red in the check cases, and the tree checks still judge only the test's seven.
