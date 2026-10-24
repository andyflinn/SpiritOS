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
| `./test/<name>-child-<test>.js` | a general test, judging `./<name>.js` and every module in `./<name>/` and below |
| `./test/<name>-sibling-<test>.js` | a general test, judging every module in `./` and below |

A `-child-` or `-sibling-` file is a general test only when `./<name>.js` stands beside the test folder. A general test
takes the file it judges as its argument and reports under its own test id for that file, so one rule over many
modules reads as one result per module.

Tests not tied to one module will live in `spirit/run/test/suites/`.

## Opting in

A module is judged by the general tests above it only once it has its own `./test/<name>.js`. A folder without one is
left alone, so the tree comes in one module at a time.

## Which tests a change runs

`testModule.js` names them; it runs none.

- `node spirit/run/test/testModule.js <file>`: the blast radius of one changed module. Its own test, every test under
  `./<name>/` (its components), and the own tests of the modules on its line upward (`../`, `../../`, up to the run
  root), never a sibling branch. General tests judge the changed file and the files below it. A module deep in the
  tree runs few tests; one near the root runs nearly all.
- `node spirit/run/test/testModule.js`: every test file in any `test/` folder of the run tree, and each general test
  once per module it judges.

An item that names one file therefore gets the right tests without listing them.

## Running them

- The harness (`node spirit/test/runAll.js`) reaches the run tree through `testModule.js` and runs each entry as its
  own suite, a general test with its file as the argument. No test of the run tree runs twice.
- Every test reports in the format of the current test system (`testSupport.js`), so the verifier records it as it
  records any suite.
- A product test that finds a module breaking a rule fails that module's test, not the item that brought the test.
