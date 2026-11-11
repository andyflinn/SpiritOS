# spirit/test/spirit-sibling-titleRules.js, every test one test.run, its title plain, steady and unique

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

## What it reads

- A suite is a `.js` file in a folder named `test`, not one of `spirit/test/`'s tools (`testReport.js`, `testModule.js`,
  `headLessChrome.js`) and not in a vendored folder.
- A test is one call to the reporter, `test.run(title, severity, body, limitMs)` (goal/G47.2; Andy: *"Every test inside
  every suite has its unique (within the suite) title. Every test supplies its severity"*; the box: *"One call per test,
  the reporter's"*). Its title is the first argument, its severity the second, a number literal from 0.0 to 1.0, its
  time limit the fourth, a number literal of milliseconds.
- The old ways of saying a check are a helper `ok` of the suite's own, `test.check`, `test.fail` and
  `test.reportSuccessFailureCount` (the box: *"No suite keeps a helper of its own that hands the reporter a title on a
  pass and other words on a fail"*).
- It is read from the code, comments left out, and the suite is never run. Words inside a string (a planted suite, a page
  script sent to Chrome) are never taken for checks; a comma inside a condition, a call or a regular expression never
  splits a call's arguments.
- Plain is one string literal: quoted, or a template with no `${}`. Anything joined, computed or named is built: a value
  can change in it between runs.

## Requirements

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

## What its test must try to break

- A title built from a count, a path, a value or a variable.
- Two checks of one suite under the same words.
- A reading that takes a comment, a string or a helper's definition for a check, or splits a condition at a comma.

On today's tree it is red: 573 titles built from values in 101 suites, and 26 titles said twice in 8. It is green on
itself.
