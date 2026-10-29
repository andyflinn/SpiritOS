# test/testReport.js

The product test system's reporter: every test in `spirit/run` prints its checks through it, and under the verifier
sends each one on (`deskVerify.record`). This test holds one part of it: **the name a test is sent by** (goal/G41.19).

Andy, on G41.19: *"RULE: The test names (what is sent to deskVerify) must ALWAYS start with the module tested:
\"/<path>/<module-no-extension>, so when i look in desk->fallout i have an instant idea which thing failed."*, and
*"i just want all tests in repo:/spirit/run 100% compliant."* Before it, a test was sent by its file's bare name, so 23
test files went by 8 names (six were `rowElement.js`), and a red in Fallout did not say which.

## Requirements

- A record's `suite` is the module the test tests, as `/<path>/<module>`: the folders between `spirit/run/` and the
  module, and the module's name without extension. The reporter makes it from the test's own path, so no test changes:
  - `spirit/run/shell/js/test/workBench.js` is sent as `/shell/js/workBench`;
  - `spirit/run/process/js/agent/table/model/test/rowElement.js` and
    `spirit/run/process/js/agent/table/provider/test/rowElement.js` are two names, each with its folder;
  - `spirit/run/spirit/test/DEBUG.js` is sent as `/spirit/DEBUG`;
  - `spirit/run/test/spirit.js`, the test of `spirit/run/spirit.js`, is sent as `/spirit`.
- **A general test is sent by the file it judges.** A `-child-` or `-sibling-` test runs once per file, the file its
  argument (`TEST_SYSTEM.md`), so the module tested is that file:
  `spirit/run/shell/test/boot-sibling-generalRules.js shell/agent/agent.js` is sent as `/shell/agent/agent`.
- **Every test name starts with the path** (Andy, box v13: *"EVERY MOTHERFUCKING TEST NAME in the product three STARTS
  WITH THE MUTHERCUCKING PATH!!!!!!!!!!"*): a record's `title` is `/<path>/<module> <section> #<n>`, the same path as
  its `suite`, so a title read alone in Fallout names its module. The two `rowElement.js` tests' titles start with
  their own paths.
- The outcome, and a red's failure, are sent as before.
- Nothing is sent when the verifier did not start the run (no `--verify-port`).

## How it is tried

A small test file is run as a child under a stand-in `spirit.js`: the reporter loads `spirit.js` for the record alone,
so the child puts a stand-in in its place whose `deskVerify.record` prints what it was given. The child's own path is
set to the test file named.

## What its test must try to break

- The bare file name, or a name without its folders.
- Two test files of one name sent by one name.
- `/test/` left in the name, or the extension.
- A general test sent by its own name instead of the file it judges.
