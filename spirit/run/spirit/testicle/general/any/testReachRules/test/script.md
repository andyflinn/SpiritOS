# The test reach rules module

goal/G49.27, step 2a. Its test is `./script.js`; the module is `../script.js`, the part `testReachRules` of the old -general runner of spirit/test/ moved into a rule module.

The box: *"Each module has its own test ... planting a tiny script breaking a rule and one keeping it, so a module that passes everything is red."*

## Requirements

- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `none`, own `false`.
- It applies to a production script and to no file in a test folder.
- On a planted run, a script that requires only a sibling keeps *"no production module loads or requires a test file"*; one that requires a file of its test folder is red on it.

## Its contract, as the old runner's spec said it (moved here, goal/G49.27, step 3: the runners of spirit/testicle/run/ have no part of their own)

### testReachRules (was script-sibling-testReachRules.js)

No production module loads a test file (goal/G41.30). The box: *"1) no production module loads or requires any test
file, with the exception of DEBUG.js."*

    node spirit/test/script-sibling-testReachRules.js [file]

**Its name is its reach** (`./TEST_SYSTEM.md`): a `-sibling-` test named after `spirit.js` (at `spirit/script.js`, beside
this test folder since goal/G43.32) judges every production module in `spirit/run/` and below. Given a file it judges
that one; given none, every tracked production `.js` file.

#### Requirements

- **A production file** is a tracked `.js` file under `spirit/run/`, not inside a `test/` folder (`spirit/test/`'s
  tools included), not vendor code (`node_modules`, CodeMirror).
- **It loads no test file**: in its code, comments left out, no `require()`, `import()`, `spirit.requireScript()`,
  `readFileSync()`, `readFile()` or `createReadStream()` names a path into a `test/` folder. The path is read from the
  call's own text, its string pieces joined as `path.join` joins them, so `path.join(__dirname, 'test', 'x.js')` is
  caught as `'test/x.js'` is.
- **Running a suite is not loading it**: a suite started as its own process (spawn, execFile, fork), as the desk and its
  verifier start suites by their path, loads nothing into the module and is not asked.
- **DEBUG.js is the one exception** (`spirit/DEBUG/script.js` and `spirit/DEBUG/`): its test routes serve a test folder's
  pages.
- Each call that breaks the rule is its own check, named by its file and line, quoting the box.
- **Never vacuous**: run over the whole tree, the scan must have read more than 100 production files, or it is red.

#### What its test must try to break

- A `require('./test/x.js')` added to a production file.
- A test file read through `path.join(__dirname, 'test', ...)`.
- A test path only in a comment, which is no load.
