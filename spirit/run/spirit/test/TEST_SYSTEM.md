# The product test system

The tests inside `spirit/run/`, the product tree (goal/G40.6). They sit beside the suites in `spirit/test/`, which
stay and run as before.

## What they are

Product tests are the **permanent** assertions about SpiritOS: its design intent, the code's compliance with it, and
the rules of quality and style. A test that only checks an item's job got done is not one of them, and sheds out once
this system runs beside the old one.

## A test has one string: its title

Andy, goal/G47.1: *"THERE'S ONLY ONE SINGLE MOTHERFUCKING STRING/TITLE ASSOCIATED WITH A TEST, IF IT FUCKING FAILS, THAT IS
FUCKING ENOUGH TO PINPOINT WHAT HAPPENED"*, *"EVERY MOTHERFUCKING TEST REPONDS WITH SUCCESS OR FAILURE AND / PLUS / INCLUDING
THE MOTHERFUCKING TITLE OF THE MOTHERFUCKING TEST"*, and *"ALL FAILURE STRING WILL BE FUCKING KILLED IN EVERY MOTHERFUCKING TEST
IN THE WHOLE MOTHERFUCKING TREE"*.

- **A test has exactly one string: its title.** Its title says what it asserts, and a red title is the whole report of
  what failed. No other string belongs to a test.
- **A test answers success or failure, and THE FUCKING TITLE.** Its body returns `true` (success) or `false` (failure) AND THE MOTHERFUCKING TITLE, since NO other string is allows to exist for a test, AND THE TITLE IS NEEDED AS KEY FOR THE FUCKING testicle row in testicle.db
- **The runner registers the result with the title alone.**, which it can only get from the MOTHERFUCKING TEST RESPONSE. THE REPORT TO THE TESTICLE SERVER IS: script, suite, title, success or failure and severity,
  ✅ or ❌, and THE MOTHERFUCKING TITLE.
- **A crash or a hang is a failure under its MOTHERFUCKING title**
- **No failure string in any test, anywhere in the tree.** A test written with one is wrong, and is fixed by taking
  the string out, never by keeping it.

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
file."*): a test named after no module is garbage, and the garbage rule of `spirit/test/script-sibling-general.js` goes red
on it.

**Three kinds of general test** (goal/G47.1, box v94, 2): *"there will be, from now on only 3 types of general tests, at any
level of the tree: <file>-<child | sibling>-general.js, <file>-<child | sibling>-node.js,
<file>-<child | sibling>-browser.js"*; *"with no script-argument, they will process all applicable scripts. else it will
process all scripts listed in the arguments that fit"*; *"node only scripts are tested by -general AND -node general tests.
browser only scripts are tested by -general and -browser general tests. if a script is NOT browser only AND NOT node only,
it will be tested by all 3 categories."* A script's class is testicle's (its script row's browserOnly and nodeOnly, set
by `spirit/testicle/scriptClassify/script.js`, a special general test under its own name, `testModule.js`'s `SPECIAL`).

The general tests of `spirit.js` stand in `spirit/run/spirit/test/` beside `spirit/run/spirit/script.js` (goal/G43.32):
each judges every module in `spirit/` and below. `script-sibling-general.js` holds the rules read from a script's file,
each part the test it was (branchRules, titleRules, noFuckingGarbage, searchRules, testReachRules).

**The tools of the test system** (goal/G43.32, Q2; goal/G49.27, Andy: *"each tool is spirit/testicle/<name>/script.js, its test
beside it"*): `spirit/testicle/testReport/`, `testModule/`, `headLessChrome/` and `scriptClassify/` are tools, not tests and no
modules. `testModule` lists none of them, the garbage rule does not judge them as tests named after no module, and each
has its own test at `spirit/testicle/<name>/test/script.js`. Every product test requires them from there.

## Every module in reach is judged

A general test judges every module in its reach, with its own `./test/<name>.js` or without one (goal/G47.1; Andy: *"all
general test will auto-opt in ANY applicable file."*). The opting in of goal/G40.6, which left a module without its own
test alone while the tree came in, is gone. A rule that does not apply to a file says so in its own code, as the mount
rules do for a script that places no element.

## Which tests a change runs

`testModule.js` names them; it runs none.

- `node spirit/run/spirit/testicle/testModule/script.js <file>`: the blast radius of one changed module. Its own test, every test under
  `./<name>/` (its components), and the own tests of the modules on its line upward (`../`, `../../`, up to the run
  root), never a sibling branch. General tests judge the changed file and the files below it. A module deep in the
  tree runs few tests; one near the root runs nearly all.
- `node spirit/run/spirit/testicle/testModule/script.js`: every test file in any `test/` folder of the run tree, and each general test
  once per module it judges.

An item that names one file therefore gets the right tests without listing them.

## Running them

- The harness (`node spirit/test/runAll.js`) reaches the run tree through `testModule.js` and runs each entry as its
  own suite, a general test with its file as the argument. No test of the run tree runs twice.
- Every test reports through `spirit/run/spirit/testicle/testReport/script.js`, the product tree's own reporter (goal/G40.13), which
  prints the lines of the old one (`spirit/test/testSupport.js`) without requiring anything of `spirit/test/`, so the
  verifier records it as it records any suite.
- **One call per test** (goal/G47.2; Andy: *"Every test inside every suite has its unique (within the suite) title. Every
  test supplies its severity and reports itself to testicle"*): `test.run(title, severity, body, limit)`, its title one
  plain string unique in its suite, its severity 0.2 by default, 0.4 for a general rule broken, 0.8 for a security hole
  (a crash or a hang is 0.7, set by the reporter), its time limit one of the reporter's named limits, `test.limit.quick`, `.slow` or `.long`. The body
  answers `true` or `false`, nothing else (below, *A test has one string: its title*). Setup goes into a "the world:" test, cleanup into `test.after(fn)`. Each test is
  reported by itself to `testicle.testicle.set` of the node of the checkout it runs in, and the suite's success for each script it judged to `testicle.suite.success` once it is through with that script (none for a run with `--test`; testicle never sums a suite's result from its test rows); `--test <title>` runs the tests up
  to that one. The titleRules part of `script-sibling-general.js` holds every suite to it. Its contract: `../testicle/testReport/test/script.md`.
- A product test that finds a module breaking a rule fails that module's test, not the item that brought the test.
