# spirit-sibling-testReachRules.js

No production module loads a test file (goal/G41.30). The box: *"1) no production module loads or requires any test
file, with the exception of DEBUG.js."*

    node test/spirit-sibling-testReachRules.js [file]

**Its name is its reach** (`./TEST_SYSTEM.md`): a `-sibling-` test named after `spirit.js` (at `spirit/spirit.js`, found
there for the run root's test folder) judges every production module in `spirit/run/` and below. Given a file it judges
that one; given none, every tracked production `.js` file.

## Requirements

- **A production file** is a tracked `.js` file under `spirit/run/`, not inside a `test/` folder (the run root's
  `test/` included), not vendor code (`node_modules`, CodeMirror).
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

## What its test must try to break

- A `require('./test/x.js')` added to a production file.
- A test file read through `path.join(__dirname, 'test', ...)`.
- A test path only in a comment, which is no load.
