# The product test system

The tests inside `spirit/run/`, the product tree (goal/G40.6). They sit beside the suites in `spirit/test/`, which
stay and run as before.

## What they are

Product tests are the **permanent** assertions about SpiritOS: its design intent, the code's compliance with it, and
the rules of quality and style. A test that only checks an item's job got done is not one of them, and sheds out once
this system runs beside the old one.

## Where they live

Any folder may hold several code files. A module `./<name>.js` keeps its component modules in `./<name>/` beside it.
The folder's `test/` holds, for each module:

| File | What it is |
|---|---|
| `./test/<name>.md` | the module's purpose and requirements: what its test must exercise, stress and try to break |
| `./test/<name>.js` | the tests of `./<name>.js`, every one of them, and of no other module |
| `./test/<name>-child-<test>.js` | a general test, judging `./<name>.js` and every module in `./<name>/` and below |
| `./test/<name>-sibling-<test>.js` | a general test, judging every module in `./` and below |

**ONE TEST FILE PER SCRIPT** (goal/G45.1; Andy: *"there is ONE FUCKING test file in the test folder per script file, and
every fucking test that applies to that file must be inserted in the that one file"*): a test folder holds `<name>.js` and
`<name>.md` for a script `./<name>.js` beside it, and the general tests, and nothing else. There is no
`./test/<name>-<what>.js`: a test of `./<name>.js` goes into `./test/<name>.js`. The `<name>-<what>.js` files still in the
tree (63 over 38 scripts, read by `testModule.js` since goal/G43.27) are folded into their script's one test file, and
`testModule.js` stops reading them.

A `-child-` or `-sibling-` file is a general test only when `./<name>.js` stands beside the test folder. A general test
takes the file it judges as its argument and reports under its own test id for that file, so one rule over many
modules reads as one result per module.

A test that does not judge the one file it is handed is never a general test: a `-sibling-` beside `spirit.js` runs once per
module, 111 times (goal/G43.2; Andy: *"it looks to me like a lazy-funcking-ass placement of tests"*). A test that covers
several modules end to end is a test of the module it is most about, in its `./test/<name>.js`, and runs once. **Every test matches a production file** (goal/G43.27; Andy: *"wsl: every test in run:/ MUST MATCH a production
file."*): a test named after no module is garbage, and the garbage rule of `spirit/test/spirit-sibling-general.js` goes red
on it.

**Three kinds of general test** (goal/G47.1, box v94, 2): *"there will be, from now on only 3 types of general tests, at any
level of the tree: <file>-<child | sibling>-general.js, <file>-<child | sibling>-node.js,
<file>-<child | sibling>-browser.js"*; *"with no script-argument, they will process all applicable scripts. else it will
process all scripts listed in the arguments that fit"*; *"node only scripts are tested by -general AND -node general tests.
browser only scripts are tested by -general and -browser general tests. if a script is NOT browser only AND NOT node only,
it will be tested by all 3 categories."* A script's class is testicle's (its script row's browserOnly and nodeOnly, set
by `spirit/test/scriptClassify.js`, a special general test under its own name, `testModule.js`'s `SPECIAL`).

The general tests of `spirit.js` stand in `spirit/run/spirit/test/` beside `spirit/run/spirit/spirit.js` (goal/G43.32):
each judges every module in `spirit/` and below. `spirit-sibling-general.js` holds the rules read from a script's file,
each part the test it was (branchRules, titleRules, noFuckingGarbage, searchRules, testReachRules).

**The tools of `spirit/run/spirit/test/`** (goal/G43.32, Q2; Andy: *"We need special rules for run://spirit/test/  it will
be where run://spirit/app/test/ finds it's main tools."*): `testReport.js`, `testModule.js` and `headLessChrome.js` are
tools, not tests and no modules. `testModule.js` lists none of them, the garbage rule does not
judge them as tests named after no module, and their own tests stay in `spirit/run/spirit/test/test/`. Every product
test requires them from there.

## Every module in reach is judged

A general test judges every module in its reach, with its own `./test/<name>.js` or without one (goal/G47.1; Andy: *"all
general test will auto-opt in ANY applicable file."*). The opting in of goal/G40.6, which left a module without its own
test alone while the tree came in, is gone. A rule that does not apply to a file says so in its own code, as the mount
rules do for a script that places no element.

## Which tests a change runs

`testModule.js` names them; it runs none.

- `node spirit/run/spirit/test/testModule.js <file>`: the blast radius of one changed module. Its own test, every test under
  `./<name>/` (its components), and the own tests of the modules on its line upward (`../`, `../../`, up to the run
  root), never a sibling branch. General tests judge the changed file and the files below it. A module deep in the
  tree runs few tests; one near the root runs nearly all.
- `node spirit/run/spirit/test/testModule.js`: every test file in any `test/` folder of the run tree, and each general test
  once per module it judges.

An item that names one file therefore gets the right tests without listing them.

## Running them

- The harness (`node spirit/test/runAll.js`) reaches the run tree through `testModule.js` and runs each entry as its
  own suite, a general test with its file as the argument. No test of the run tree runs twice.
- Every test reports through `spirit/run/spirit/test/testReport.js`, the product tree's own reporter (goal/G40.13), which
  prints the lines of the old one (`spirit/test/testSupport.js`) without requiring anything of `spirit/test/`, so the
  verifier records it as it records any suite.
- **One call per test** (goal/G47.2; Andy: *"Every test inside every suite has its unique (within the suite) title. Every
  test supplies its severity and reports itself to testicle"*): `test.run(title, severity, body, limit)`, its title one
  plain string unique in its suite, its severity 0.2 by default, 0.4 for a general rule broken, 0.8 for a security hole
  (a crash or a hang is 0.7, set by the reporter), its time limit one of the reporter's named limits, `test.limit.quick`, `.slow` or `.long`. The body
  answers `true`, or what went wrong. Setup goes into a "the world:" test, cleanup into `test.after(fn)`. Each test is
  reported by itself to `testicle.testicle.set` of the node of the checkout it runs in, and the suite's success for each script it judged to `testicle.suite.success` once it is through with that script (none for a run with `--test`; testicle never sums a suite's result from its test rows); `--test <title>` runs the tests up
  to that one. The titleRules part of `spirit-sibling-general.js` holds every suite to it. Its contract: `./test/testReport.md`.
- A product test that finds a module breaking a rule fails that module's test, not the item that brought the test.
