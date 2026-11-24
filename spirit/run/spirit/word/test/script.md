# word.js

`spirit/run/spirit/word/script.js` tracks the namespace claims (goal/G43.4). Its test is `./word.js`.

Andy, box: *"i will track nameSpace claims."*

## Requirements

- A word is a string of `a` to `z`. word.js hard-codes a set of words, *"(this may change)"*. The test reads that set from word.js itself and keeps no copy of it (Andy, 2026-11-17: *"WHY WOULD A TEST HARD-CODE reserved words?"*, *"IT's like hardcoded apps! IDIOTIC!"*): every word Andy adds or takes out is judged the day he does. The set read is red when it is empty or lacks `spirit`.
- `check('path.in.words', 'word')` compares case-insensitively and answers the lower-case word, else null. It looks at the `word.json` of each level on its path below the root, and at the hard-coded words. It reads no `run://spirit/word/script.json`. It sees nothing lower down and nothing in another branch.
- A word an object inherits, like `constructor`, is not reserved. A missing `word.json` counts as empty. A `word.json` is an object of word to `true`.
- A changed `word.json` is seen by the next `check`.
- On a page `spirit.required.spirit.word.script.check` answers through a promise, since a page asks its node for each `word.json`, kept until the node's file stream says it changed; `spirit.required.spirit.word.script.changed(fn)` tells a listener when one does. `spirit/element/search/file/row/script.js` paints from these; its test judges them.
- **No ask for a `word.json` that is not there** (goal/G43.32; cw measured on Andy's node 1821 requests on opening Files,
  1818 of them 404, all `fs.load` of a `word.json`; Andy: *"wsl, add a test to test/word.js to make sure this won't
  happend again."*): on a page `word.js` asks only for a `word.json` the node's file list (`spirit.required.spirit.data.fs`) holds, and
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
- A hard-coded word needs no folder at `spirit/` and no object on the spirit object (Andy, Q34: *"no."*, superseding his answer to cw's Q2).
- `spirit` is exempt: *"in tests it is exempt from discrepancy rules."*

## Red by design

A reserved word needs no home of its own (Andy, Q34: *"no. the word system is more about what <word>.js and <word>/ are reserved specifically in app and branch folders"*): no check asks spirit/<word> or spirit.<word>. What stays red: the rule that nothing below takes a word reserved above it, wherever a hard-coded word (api, element, row, detail and more) names a file or folder lower in the tree, which is the use Andy describes for them; it waits on his word.
