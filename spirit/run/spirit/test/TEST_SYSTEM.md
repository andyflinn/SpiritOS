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
| `./test/<name>.js` | the tests of `./<name>.js`, and of no other module |
| `./test/<name>-<what>.js` | more tests of `./<name>.js` by name, each with its `.md`; `testModule.js` runs them with `./<name>.js` (goal/G43.27) |
| `./test/<name>-child-<test>.js` | a general test, judging `./<name>.js` and every module in `./<name>/` and below |
| `./test/<name>-sibling-<test>.js` | a general test, judging every module in `./` and below |

A `-child-` or `-sibling-` file is a general test only when `./<name>.js` stands beside the test folder. A general test
takes the file it judges as its argument and reports under its own test id for that file, so one rule over many
modules reads as one result per module.

A test that does not judge the one file it is handed is never a general test: a `-sibling-` beside `spirit.js` runs once per
module, 111 times (goal/G43.2; Andy: *"it looks to me like a lazy-funcking-ass placement of tests"*). A test that covers
several modules end to end is a test of the module it is most about, `./test/<name>.js` or `./test/<name>-<what>.js`,
and runs once. **Every test matches a production file** (goal/G43.27; Andy: *"wsl: every test in run:/ MUST MATCH a production
file."*): a test named after no module is garbage, and `spirit/test/spirit-sibling-noFuckingGarbage.js` goes red on it.

The general tests of `spirit.js` (`spirit/run/spirit/test/spirit-child-generalRules.js`, `spirit-sibling-generalRules.js`,
`spirit-sibling-searchRules.js`, `spirit-sibling-testReachRules.js`, `spirit-sibling-noFuckingGarbage.js`) stand in
`spirit/run/spirit/test/` beside `spirit/run/spirit/spirit.js` (goal/G43.32): `-sibling-` judges every module in
`spirit/` and below with its own test; `-child-` of `spirit.js`, its folder's namesake, judges `spirit/spirit.js` and
`spirit/` below too.

**The tools of `spirit/run/spirit/test/`** (goal/G43.32, Q2; Andy: *"We need special rules for run://spirit/test/  it will
be where run://spirit/app/test/ finds it's main tools."*): `testReport.js`, `testModule.js` and `headLessChrome.js` are
tools, not tests and no modules. `testModule.js` lists none of them, `spirit-sibling-noFuckingGarbage.js` does not
judge them as tests named after no module, and their own tests stay in `spirit/run/spirit/test/test/`. Every product
test requires them from there.

## Opting in

A module is judged by the general tests above it only once it has its own `./test/<name>.js`. A folder without one is
left alone, so the tree comes in one module at a time.

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
- A product test that finds a module breaking a rule fails that module's test, not the item that brought the test.
