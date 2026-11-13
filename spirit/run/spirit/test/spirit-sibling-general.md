# spirit/test/spirit-sibling-general.js

The -general general test beside spirit.js (goal/G47.1, box v94, 2: *"there will be, from now on only 3 types of general
tests, at any level of the tree: <file>-<child | sibling>-general.js, <file>-<child | sibling>-node.js,
<file>-<child | sibling>-browser.js"*, *"existing general tests fold into the appropriate of the 3 new general test
name-formats"*). It holds the checks that judge a script from its file alone, each part the general test it was, every
title kept: generalRules (its file-reading checks), branchRules, titleRules, noFuckingGarbage, searchRules, testReachRules.

    node spirit/test/spirit-sibling-general.js [<script or folder> ...]

- *"with no script-argument, they will process all applicable scripts. else it will process all scripts listed in the
  arguments that fit"*: no argument, each part judges everything it applies to; each argument, each part judges it when
  it fits and nothing when it does not (branchRules a file judges its branch, and a file in no branch nothing; testReachRules
  a test file nothing), its results reported for that argument (testReport's test.forScript).
- *"node only scripts are tested by -general AND -node general tests. browser only scripts are tested by -general and
  -browser general tests"*: this test judges every script, whatever its class.

Each part's contract, as it stood under its own name:

## branchRules (was spirit-sibling-branchRules.js)

Every rule of a branch, judged on each branch folder (goal/G43.32). A general test beside `spirit.js`, outside every
branch. Run once per branch folder, the folder its argument; given none, every branch:

    node spirit/test/spirit-sibling-branchRules.js spirit/app/desk

Andy: *"make sure nobody can add an app implementing a family, without adhering to the rules, this means that a test
outside of each branch must assert this."*, *"such a general test must therefore "recognize" a branch folder, and assert
all rulers relating to branches."*, *"would that not actually be a general test spirit-sibling-branchRules?"*, and to Q7:
*"branch test only needs to associate a failure with either spirit/<name>/ or spirit/app/<name>/"*.

It took in, per branch, the branch rules of five tests (Q6: *"absolutely, AND MAKE SURE NO TEST GETS LOST."*):
`spirit-familyFinder.js`, `data-caches.js`, `apiDoor-familyGate.js`, `server-appFamily.js`,
`introSpector-branchVerbs.js`. What judges no branch stayed with the test of the module it judges: `./data.js`, once `./data-caches.js`
(the data set, `spirit/data.js`) and `./spirit.js`, its familyFinder part (the finder, on planted folders); the other three are
gone. From `./app.js`: that an app's description names its icon and label. A scratch node; never a live one.

### Requirements

#### A branch folder, recognized

- **By its folder** (`testModule.js` `branchesOf`; Andy: *"app-branches are easily identified using the patterns:
  spirit/app/<name>/<name>.js, spirit/app/<name>/<name>.json"*, *"and system branches by: spirit.<name>.api.js &&
  spirit.<name>.data.js"*): a system branch is `spirit/<name>/` holding `api.js` and `data.js`, `spirit/app/` among them
  (the branch `app`); an app branch is `spirit/app/<name>/` holding its manifest `<name>.json` (since goal/G43.32: rule 2; rule 4 left a face-only app no `<name>.js`). A test folder is none.
- **`testModule.js` gives it one entry per branch folder**, and on a blast radius the deepest branch holding the file
  (`spirit/app/desk/desk.js` is `spirit/app/desk`'s, not `spirit/app`'s). A module in no branch gets none.
- **Every check is named by its branch folder** or a file in it. A folder given that is no branch is red.
- **The tree is every file git keeps and every file not yet added that git does not ignore**, so a new app's branch is
  judged before it is committed.
- Given no folder, it must have found over 20 branches, desk's and fs's among them.

#### Its interface, where it holds an api.js

- **Its verb rules live in its `api.js`** (decided 7): it loads, and declares each verb as its arguments and their rules.
- **It stands where its family is found** (goal/G43.27, the fewest path elements): `spirit.familyPath(<name>)` is its
  `api.js`; and **no other `<name>/api.js` is in the tree** (`spirit/<name>/`, `spirit/app/<name>/`,
  `process/js/<name>/[family/]`; Andy: *"duplicate <name>/api.js raise a red."*).
- **Required on the node it is placed and binds** (decided 8: *"A branch's api.js is placed at
  spirit.required.spirit.<branch-path>.api and also binds the branch."*): in a process of its own, `spirit.require` of it
  leaves the `api.js` at `spirit.required.<its path>`, and binds every verb it declares on `spirit.<name>`, under the name
  its `functions` gives it if any (`spirit/app/api.js`: `search` is `searchApp`).

#### An app branch's description

- **`<name>.json` names `identity.icon` and `identity.label`** (`AGENT.md`, an app: *"each described by its own
  <name>/<name>.json"*; Andy, box: *"containing identity:icon and identity:label"*).
- **It has no `kind` or `operated`**: the node operates the server (`./appServer.md`).
- **Its name is no verb of the app family** (Andy, box: *"spirit.app also holds the family's verb, search, so no app may
  take the name of a verb."*).

#### Its cache, where it holds a data.js

Andy, on G41.28: *"WSL, make sure you assert that every family in the api tree HAS a clientCacheManager, AND the a
node.js Process like DeskClient uses the Exact same code as the browser for the cache management. The only difference
is the appServer serializes the cache to disk."*

- **A branch with an interface has its `data.js`** in its own folder.
- **Its branches are named by it alone**: the names it gives `var` constants (`var ITEMS = 'desk'`); no other file hands a
  path of them to a `spirit.data` reader or writer (`D.get('desk/' + id)`).
- **It touches no file and no browser storage**: no `fs` or `path`, no file read or written, no browser storage.
- **It makes the branch of its folder's name** (goal/G43.31; Andy: *"The BRANCH name (FUCK THE TERM "Family"!!!!!!!!!!!!) is
  motherfucking <name> in spirit/app/<name>...."*, *"make sure, IN THIS ITEM that family names MATCH folder names"*):
  `makeFamily('<name>')`, `<name>` its folder's (from `./spirit-sibling-generalRules.js`).
- **One contract**: it loads, exports cache rules only as an object, and stands at `spirit.data.<name>` through
  `spirit.data.makeFamily`, the name it hands `makeFamily`.
- **A branch's watch is called `watch`** (Andy: *"that's a decision: a BRANCHE's what is called "watch""*, *"the branch is
  already implied in it's containing object."*, *"wsl, assert this in a test for branches."*): every object its reads hold
  names no member `watch` and more (`watchFile`, `watchApp`, `watchRow` are the names it replaces), and no `watch` takes
  more than the function and the row it narrows to.

#### On a node, where it holds an api.js

A scratch node; an app branch switched on first (`app.active`), as its server must run to serve it.

- **The node's api tree holds it**, and **the interface it serves for it is its own `api.js`** (goal/G43.27, requirement 2:
  server.js familyDir looks for `spirit/app/<name>/api.js`; appServer.js takes the app folder itself as the family folder).
- **It serves exactly the verbs its `api.js` declares** (goal/G43.20; Andy: *"IN THIS ONE, OR WE'LL NEVER GET FUCKING
  DONE."*, *"WSL, NOTE AND ASSERT THIS IN YOUR TESTS, IN THE PROPER PLACE, DILIGENTLY WITHOUT FUCKING CHEATING."*), beyond it
  only what was decided: appServer's `DEBUG` (desk/G2.5: *"DEBUG auto-verb supplied by appServer is approved."*), and desk's
  `item.rules.add` and `item.rules.remove` (goal/G40.12). **No FS set** among them.
- **Every broken call is refused at the door** (goal/G41.30; Andy: *"this needs fixing in this item."*; an app's in its own
  process, decided 9): from its declaration, a raw call over http breaks each verb's arguments three ways, an argument of
  the wrong type, a required one left out, one the verb does not name; each answers a 4xx with a `code`, never a 2xx, a
  5xx, a handler failed, or no answer within 8 s. A branch that declares no verb has no call to break, and says so.
- **Found by its name, on a page**: a page asking `spirit.cacheManager(<name>)` gets its own `data.js`, and asks no
  `data.js` of that name that is not there (no 404); **the node serves it as a script that calls `makeFamily`**.

### What its test must try to break

- A new app, not yet committed, whose branch breaks a rule; a folder given that is no branch.
- An `api.js` that does not load or declares no verbs; one no finder reaches; a second of the name; one not placed at
  `spirit.required.<its path>` on the node, or a verb left unbound.
- A description without its icon or label, with `kind` or `operated`, or an app named as a verb of the app family.
- A branch named otherwise than its folder (`chatClerver` in `spirit/app/chat/`); a branch with an interface and no `data.js`; a branch's path named outside its manager; a manager keeping its cache on
  disk or in browser storage; a manager without the contract; a watch of another name, or told its branch.
- A branch the node does not serve, serves from another file, serves with a verb more or less, or with an FS set.
- A handler reached by a call its own declaration refuses.
- A page that cannot find a branch's manager by its name; a manager the node does not serve.

## titleRules (was spirit-sibling-titleRules.js)

A general test beside `spirit/spirit.js` (`./TEST_SYSTEM.md`): it judges the suites under spirit/ and below. It is the red
every test-title item of goal/G45 shares (goal/G45.3): each title item's red is this test run on its own folder. Its test
is itself: it reads suites planted in memory before it judges any real one.

The box: *"every test's title is a plain string; it is steady, with no count, value, path or number built into it; and it
is unique within its suite."*, *"Run on a folder, it judges that folder's suites alone"*, *"It writes no title itself and
changes no other suite."* A title is what failed when a test is red, and the key a test is kept by (goal/G45.1: *"A test's
key is its description, nothing else"*): a title that changes from run to run is a new test each run.

    node spirit/test/spirit-sibling-titleRules.js spirit/app/desk          every suite under that folder
    node spirit/test/spirit-sibling-titleRules.js spirit/app/desk/desk.js  that production file's own suite
    node spirit/test/spirit-sibling-titleRules.js spirit/test/data.js      that suite
    node spirit/test/spirit-sibling-titleRules.js                          every suite of the tree

### What it reads

- A suite is a `.js` file in a folder named `test`, not one of `spirit/test/`'s tools (`testReport.js`, `testModule.js`,
  `headLessChrome.js`) and not in a vendored folder.
- A test is one call to the reporter, `test.run(title, severity, body, limit)` (goal/G47.2; Andy: *"Every test inside
  every suite has its unique (within the suite) title. Every test supplies its severity"*; the box: *"One call per test,
  the reporter's"*). Its title is the first argument, its severity the second, a number literal from 0.0 to 1.0, its
  time limit the fourth, one of the reporter's named limits, `test.limit.quick`, `.slow` or `.long`, never a number of
  its own (Andy, 2026-11-11: *"i hope you have those as relatively central constants"*).
- The old ways of saying a check are a helper `ok` of the suite's own, `test.check`, `test.fail` and
  `test.reportSuccessFailureCount` (the box: *"No suite keeps a helper of its own that hands the reporter a title on a
  pass and other words on a fail"*).
- It is read from the code, comments left out, and the suite is never run. Words inside a string (a planted suite, a page
  script sent to Chrome) are never taken for checks; a comma inside a condition, a call or a regular expression never
  splits a call's arguments.
- Plain is one string literal: quoted, or a template with no `${}`. Anything joined, computed or named is built: a value
  can change in it between runs.

### Requirements

- It reads planted suites correctly: it finds every test, and none in a comment; a quoted string and a plain template are
  plain; a joined string, a template with `${}` and a bare name are built; commas inside a body or a regular expression
  do not split arguments; a title said twice is found; a severity that is no number from 0.0 to 1.0, a test with no time
  limit, and every old way of saying a check are found.
- Every suite says its tests through `test.run`, and no suite keeps an old way of saying a check.
- Every test gives its severity, a number from 0.0 to 1.0, and its time limit, a number of milliseconds.
- The suites it is asked for are judged, and there are suites and checks to judge.
- Every title is one plain string, nothing built into it.
- No suite says one title twice.
- Its own titles name no file and no count: which suites and how many are its failure details, never its titles.

### What its test must try to break

- A title built from a count, a path, a value or a variable.
- Two checks of one suite under the same words.
- A reading that takes a comment, a string or a helper's definition for a check, or splits a condition at a comma.

On today's tree it is red: 573 titles built from values in 101 suites, and 26 titles said twice in 8. It is green on
itself.

## noFuckingGarbage (was spirit-sibling-noFuckingGarbage.js)

No garbage in a test folder (goal/G43.27). Andy: *"fucking wsl now is starting to motherfucking put tests into the run:/
folder that are NOT bound by the fucking product test system: A NEW FUCKING WAY TO INTRODUCE GARBAGE AND STALE
SHIT!!!!!!!!!!!!!!!!!"*, *"wsl: add a general test: spirit-sibling-noFuckingGarbage tests.... thing..."*, and *"wsl:
every test in run:/ MUST MATCH a production file."*

    node spirit/test/spirit-sibling-noFuckingGarbage.js [file]

**Its name is its reach** (`./TEST_SYSTEM.md`): a `-sibling-` test named after `spirit.js` (at `spirit/spirit.js`, beside
this test folder since goal/G43.32) judges every tracked file in a `test/` folder of `spirit/run/` and below, vendor
code left out. `testModule.js` hands it each module in its reach: handed `spirit/spirit.js`, or nothing, it reads
every test folder, so garbage named after no module is told once, under spirit.js; handed another module, the files of
the `test/` folder beside it named after it; handed a file in a test folder, that one.

### Requirements

- **A test folder belongs to a module**: the folder it sits in holds a `.js` module.
- **`spirit/test/`'s tools** (goal/G43.32, Q2; Andy: *"We need special rules for run://spirit/test/  it will be where
  run://spirit/app/test/ finds it's main tools."*): `testReport.js`, `testModule.js` and `headLessChrome.js`, as
  `testModule.js` lists them, and `TEST_SYSTEM.md` are bound there, not tests named after no module.
- **A `test/` inside a `test/` folder** holds the tests of the files beside it, `<name>.js` and its `.md`. Nothing
  else.
- **Every other test matches a production file** (Andy: *"every test must be directly (by name) or indirectly (by
  general rule) be associated with a production file"*): `test/<name>.js`, or a general test `<name>-child-*` or
  `<name>-sibling-*`, of a `<name>.js` beside the folder. A test named after no module is garbage.
- **One test file per script** (goal/G45.1, `./TEST_SYSTEM.md`; Andy: *"there is ONE FUCKING test file in the test folder
  per script file, and every fucking test that applies to that file must be inserted in the that one file"*): a
  `test/<name>-<what>.js` or `.md` beside `test/<name>.js`'s script is red, a second test file of `<name>.js`.
- **A test and its spec together**: a `.js` has its `.md` beside it, and an `.md` its `.js`.
- **Any other file** (a laid page, a fixture) is named after a module beside the folder: `<module>-<what>.<ext>`.
- **Every production script has its own test** (goal/G47.1; Andy: *"spirit-sibling-noFuckingGarbage should also report
  missing tests, and of course run for a specified script file, or all script files"*, *"damn right, every missing
  script-companion-suite is a red at 0.2"*, *"it is ok to exclude the vendored scripts."*): one check, severity 0.2, red
  while a production script (a tracked `.js` in no `test/` folder, vendored code left out) has no `test/<name>.js` beside
  it, its answer naming every such script. Over the whole tree it judges every production script; handed one script,
  that one. Handed a file in a test folder, it is not made.
- Each garbage file is its own check, named by its path, with the reason.
- **Never vacuous**: run over the whole tree, it must have read more than 100 files, or it is red. Handed a file that
  is not in a test folder, it is red.

### What its test must try to break

- A plain test named after no module beside the tools in `spirit/test/`.
- A test in `test/test/` of a file that is not in `test/` (`test/test/oneDoor.js`, before goal/G43.27 deleted it).
- A test named after no module beside its folder (`spirit/app/test/deskMove.js`, before goal/G43.27 renamed it), and a
  `<what>-<more>.js` whose first word is no module beside the folder.
- A `.js` without its `.md`, an `.md` without its `.js`.
- A `test/<name>-<what>.js` of a script that has its one test file, `test/<name>.js`.
- A fixture named after no module (`provider-picker.html`, where there is no `provider.js`).

### The three kinds of general test (goal/G47.1, box v94, 2)

- Every general test (a file in a test folder named `<file>-child-…` or `<file>-sibling-…`) is
  `<file>-<child | sibling>-<general | node | browser>.js`, its `.md` the same, and no other name: one check, severity
  0.4, naming each general test of another name.

## searchRules (was spirit-sibling-searchRules.js)

The search rule of a module (goal/G41.28), judged in its code. It runs once per file, the file its argument, as
`./spirit-sibling-generalRules.js` does:

    node spirit/test/spirit-sibling-searchRules.js spirit/app/desk/desk.js

**Its name is its reach** (`./TEST_SYSTEM.md`): a `-sibling-` test beside `spirit.js` judges every module in
`spirit/run/` and below, a server and a page alike, with its own test or without (goal/G47.1). Given no file, it judges every module
`testModule.js` gives it, each its own check, named by its path.

`spirit.js` has been at `spirit/run/spirit/spirit.js` since goal/G43.18; `testModule.js` finds it there for the run
root's test folder (`./TEST_SYSTEM.md`), so this file is a general test, run once per module it judges.

Andy, box v15: *"the ServerSide of probability Search is NOT searching the whole row of the object."*, *"a probability
search of a dataBase table must ALWAYS search the whole bloody ROW, as it is served through a single-row "get", using
a probabilityStringObjectMatch."*

### Requirements

- **It hands every search the row whole**: in its code, comments left out, no call of `probabilityStringObjectMatch`
  hands it an object literal, `{ id, title, box }`, the fields picked on the spot. Each call that does is named by its
  line.

What a module builds by hand before the call (a `flat` copy of some fields) is not seen here; a table's own test asks
that a word in any field its get serves finds the row (`spirit/app/agent/table/test/rowTable.md`).

### What its test must try to break

- An object literal of picked fields handed to `probabilityStringObjectMatch`, on one line or over several.
- A comment that names such a call counted as one.

## testReachRules (was spirit-sibling-testReachRules.js)

No production module loads a test file (goal/G41.30). The box: *"1) no production module loads or requires any test
file, with the exception of DEBUG.js."*

    node spirit/test/spirit-sibling-testReachRules.js [file]

**Its name is its reach** (`./TEST_SYSTEM.md`): a `-sibling-` test named after `spirit.js` (at `spirit/spirit.js`, beside
this test folder since goal/G43.32) judges every production module in `spirit/run/` and below. Given a file it judges
that one; given none, every tracked production `.js` file.

### Requirements

- **A production file** is a tracked `.js` file under `spirit/run/`, not inside a `test/` folder (`spirit/test/`'s
  tools included), not vendor code (`node_modules`, CodeMirror).
- **It loads no test file**: in its code, comments left out, no `require()`, `import()`, `spirit.require()`,
  `readFileSync()`, `readFile()` or `createReadStream()` names a path into a `test/` folder. The path is read from the
  call's own text, its string pieces joined as `path.join` joins them, so `path.join(__dirname, 'test', 'x.js')` is
  caught as `'test/x.js'` is.
- **Running a suite is not loading it**: a suite started as its own process (spawn, execFile, fork), as the desk and its
  verifier start suites by their path, loads nothing into the module and is not asked.
- **DEBUG.js is the one exception** (`spirit/DEBUG.js` and `spirit/DEBUG/`): its test routes serve a test folder's
  pages.
- Each call that breaks the rule is its own check, named by its file and line, quoting the box.
- **Never vacuous**: run over the whole tree, the scan must have read more than 100 production files, or it is red.

### What its test must try to break

- A `require('./test/x.js')` added to a production file.
- A test file read through `path.join(__dirname, 'test', ...)`.
- A test path only in a comment, which is no load.

## generalRules (was spirit-sibling-generalRules.js; its file-reading checks are this part, its node checks spirit-sibling-node.js, its page checks spirit-sibling-browser.js)

Given no file, the tree's rules: no module names spirit/run/process; elements placed by installSpiritElement alone and
none reading spirit.elements; run://test/ moved into run://spirit/test/ and named nowhere; testModule.js listing no tool as
a test; .gitignore covering run:// but run://spirit/; every product script holding the shape, taking spirit.js first,
its require paths within the rule; every file that paints icons loading the icon element. Given a file, its code: no
spirit/run/process named; the shape; spirit.js first (or page code, or spirit.js itself); its require paths; for an
element, no matched() of its own, its writes watched in spirit.data, no api taken from what it is handed. Its full
contract, page parts included, is in `spirit-sibling-browser.md`.
