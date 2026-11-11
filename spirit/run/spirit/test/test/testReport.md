# spirit/test/testReport.js

The product test system's reporter: every suite in `spirit/run` says its tests through it, and it reports each one to
testicle (goal/G47.2). Its one test is `./testReport.js`.

The box (goal/G47.2): *"Every test inside every suite has its unique (within the suite) title. Every test supplies its
severity and reports itself to testicle, with the appropriate severity if the test hangs or crashes, else with the default
severity. Every test holds on one single string, the title, which is supplied with the report, success or failure."* The
report carries *"the tested filename, scoped to run://"*, *"the suite filename, scoped to run://"*, *"the test title
(unique within the suite)"*, *"the result (success|fail)"*, *"the severity of the failure, according to the guidelines:
default (0.2), general rule violation (0.4), crash/hang (0.7), security (0.8)"*.

## The call

    test.run(title, severity, body, limit)
    test.after(fn)

`body()` returns `true` to pass; `false`, or a string saying what went wrong, to fail; it may be async. `limit` is the
test's time limit, one of the reporter's named limits, `test.limit.quick` (10 s, a test that asks and answers),
`.slow` (60 s, one that starts a scratch node, a desk or a Chrome page) or `.long` (300 s, a whole world end to end);
they sit in the reporter alone, so one change there moves every suite (Andy, 2026-11-11: *"i hope you have those as
relatively central constants"*). A limit catches a hang, not a slow machine. `test.after(fn)` runs once every test has run, whatever
they did. The tests run one at a time in the order given; the reporter prints a line for each, reports each, then prints
the completion line and ends the process, its exit code 1 when a test failed.

## Requirements

- A body returning true passes, printed under its title; returning a string fails, its title printed with the string as
  detail; returning false fails.
- **A crash and a hang** (*"a throw or a rejection, that test fails at 0.7 under its own title, the error as detail, and
  the next runs"*; *"each test raced against its own time limit ... 0.7 under its title"*): a body that throws or rejects
  fails under its title, the error as detail; a body still running at its limit fails under its title as a hang; the
  tests after both still run. Both are reported at 0.7.
- `test.after` runs once every test has run. The completion line counts every test; the exit code is 1 when one failed.
- **The report**: each test to `testicle.test.set` of the node of its checkout (spirit.js reads the port from that
  checkout's `spirit/state/environment.json`), once, `{script, suite, test, verified, severity}`: the script tested and
  the suite scoped to run://, the title as the test, the result, the severity the test gives. A failure's words never go
  into the title.
- **A general test** reports the file it judges, its argument, as its script.
- **One test alone** (*"each suite can run one test only, if that test is supplied as an extra argument, its title"*,
  *"if a test depends on other tests running first, then the sequence is run up to the specified test"*): `--test
  <title>` runs the tests up to and including it, and none after.
- A title said a second time in one suite fails the second time; a severity outside 0.0 to 1.0 fails its test.
- With no node, a suite reports nowhere and still prints its lines.

## How it is tried

A scratch run tree under the system's temporary folder holds a copy of `spirit/` and of `../testReport.js`, planted suites
using it, and an `environment.json` naming a fake node this test stands up: it answers `api {family: testicle}` with
testicle's real `api.js` and keeps every `testicle.test.set`. A second scratch tree has no `environment.json`. No live
node is touched.

## What its test must try to break

- A failing test reported under its failure words, or by its place; a test reported twice or not at all.
- A crash or a hang that ends the suite, or is reported under another test, or at another severity.
- `--test` running tests after the one named, or not the ones before it.
- A suite that stops printing when no node is there.
