# spirit/app/testicle/testicle.js

testicle's server (goal/G47.1, the server cycle): it keeps the first two tables of testicle.db, `file` and `suite`, in
sync with run:// by itself. Its test is `./testicle.js`. The tables' columns are goal/G45.1's box.

## Requirements

The box, in Andy's words where he gave them:

- *"The server mounts beside the face (testicle.json: node.mount true); testicle.db sits in testicle's state folder"*:
  `node.mount` true, `mount` naming `testicle.js` beside `element.js`; `spirit/state/testicle/data/testicle.db`.
- *"The testicle server will serve one first verb, "busy": it returns true if it is doing any work, false if it is
  idle."*: the node lists `testicle.busy`; idle it answers false; asked over and over in the second after a general
  test changes, it answers true at least once; once that work is done, false again.
- *"A product file or a suite that has not changed has no row in the database yet: nothing is read at start."*
- *"on any change of a product file it makes sure that file has its row, and a suite row for every suite that concerns
  it"*. A `file` row: `name` (the path in run://), `hash`, `deleted` false, `changed` a numeric UTC timestamp. A `suite`
  row: `file`, `suite`, `test` flagged, `hash` the suite file's own, `deleted` false, `outcome` empty (nothing runs a
  suite this cycle), `changed`.
- *"The suites that concern a file: its own test/<name>.js, and the general tests that would include that production
  file if they were run without a file argument"*, taken from `testModule.js` run as its own process with no file.
- *"When a suite or a product file is changed or added, the server adjusts the two tables file and suite by itself"*: a
  changed file gets its new hash and `changed`; a changed or added suite its new hash on its rows, flagged `test`, and a
  row for each file it concerns, that file's own row with it; a changed general test a row for every file it judges.
- *"A removed file's row is marked deleted"*, its suite rows with it.
- *"Any change in files is reflected in the database 1 second after it occurs; the tests ensure it"*: every check reads
  the tables exactly one second after the change.

- **testicle.script.get** (goal/G47.1, the verbs cycle; named file.get until the rename), its argument the script row's key, `name`: a file that is no
  production script, a `.md` or a script in a test folder, answers the error *"not a production script"*; a production
  script not on disc *"no such file"*; a production script with no rows gets its file row and a suite row for every
  suite that concerns it, flagged needs testing, *"with the same code the server uses when it discovers a file change"*,
  and the answer is that file row; a file with rows answers its row as it stands.
- **testicle.suite.search** {script, text}: *"A standard table search response"*, `{items: [{key, label}], more}`, each
  label the row; *"The file row owns its suite rows ... So suite.search takes the production file and answers that file's
  suite rows only, each suite once, with its filename and its status; the words narrow among them"*: with no words the
  file's suites exactly; every suite a file whose final folder is `test`; each with its status, needs running; words
  narrow them; another file's search answers none of the first's. Given no script, *"suite.search given no script
  answers that list"*, every suite, each once: the suites of every script, none twice, and a suite of two scripts once.
- **The queue** (goal/G47.1): *"The flags are the queue ... nothing is queued twice"*, *"One runner: one suite process at a
  time, never two. It starts 1 second after the last file change event; a new event pushes the start back"*, *"General tests
  first"*, both hashes on every result taken at the run's start, a change mid-run not killing the job and the suite coming
  round again, *"A job that runs past 2 minutes is killed"*, the 🏃‍♂️'s testicle.run to the head of the queue, and rows
  flagged at start run 1 s after the server starts. Planted suites log their start and end to runlog.txt in the scratch
  root: nu and xi run by themselves, not before 1 s after the second change, never overlapping, nu once; nu.js's general
  results all before nu's own start; nu's row holds its script's and suite's hashes; pi changed mid-run keeps its start
  hash, ends, and runs again after; tau asked by testicle.run starts before omicron's own suite and beside no other run;
  upsilon flagged, the node restarted, runs by itself; rho killed past 2 minutes, its first test failed, its suite still
  red; sigma, hung before any test, still red.
- **A suite's status**, the server's alone, from its own table (goal/G47.1): *"needs running"* when it never ran (zeta's own
  suite), *"green"* when every test of it passed (mu's general suite, after its run), *"still red"* when it ran with a failed
  test for the script (kappa's own suite, after its run), and *"needs running"* again once the script changed (mu.js
  changed). Andy: *"the suites have NO business changing the "needs running" flag on the suite rows!"*

- **The rename** (goal/G47.1, the cycle "the test table renamed testicle"): *"The testicle test table is renamed
  \"testicle\": the table in testicle.db, its index, and the branch data.js keeps it under. The stream carries it as the
  table testicle."*; *"test.set becomes testicle.set, test.search becomes testicle.search, their json files with them;
  red stays red."* After start testicle.db holds the table testicle, its index on it, no table test; no older rows are
  carried over (Andy struck that line). The node lists testicle.set and testicle.search and neither old verb;
  testicle.test.set answers no such verb. Every check above calls the new names.
- **A test's history** (goal/G47.1, the cycle "the testicle search"; the old ruling amended, Andy: *"test.search will return
  only current test rows by default, unless a valid test-Title is supplied, in which case all rows will be show that
  match: \"script, suite AND title\""*): theta's first question, set passing, failing and passing, answers its three rows,
  one current, newest first, none of another test; without a title, its current row alone.
- **run** (goal/G47.1, the cycle "run a suite from the script tab"): *"A new testicle verb, run {script, suite,
  testicle}"*, *"For this cycle the server answers run at once"*, *"testicle given: the suite runs up to that test ... testicle
  missing ... the whole suite"*, *"A general test is started with the script as its argument; a script's own test with
  none"*. The scratch tree plants kappa (its own test waits three seconds, then passes one, fails one, and checks it was
  started with no argument), lambda (three tests) and mu (a -child- general test checking it was given mu.js). The node
  lists run; run of kappa answers within 2.5 s with none of its rows yet; then all four rows come, with their results;
  run of lambda given its second test makes rows for the first and second, none for the third; run of mu makes mu's row,
  passing.
  The branch and the stream are judged in the face test; the reporter's call in its own test (`spirit/test/test/testReport.js`).
  - *"test.search will only return \"current\" test rows for the script/suite combination supplied ... no script in the
    search query searches tests for any script; the same for suite"*: `{items, more}`, the current rows only, one per
    test; with no script, that suite's for any script; with no suite, that script's in any suite; with neither, all.
    *"Most severe first applies to all test searches."*, since *"Every test search answers its failed tests first, then by
    severity"*: theta's two failed tests, 0.9 then 0.3, before its passed one. *"Red, green, the script and the suite go
    to the server with the words, so the server narrows before it cuts an answer"*: result red answers the failed alone,
    green the passed alone, any other result is refused; *"the page asks for the following answers while the server says
    there are more"*: from 1 starts the answer after the first row. Cut, the answer with neither holds the failed first.
  - *"The verb red is testicle.red"*, *"search all failed, current tests, most severe first"*: every failed current test,
    no other, most severe first.
  - The search fix (goal/G47.1, the box: *"Every test search answers its failed tests first, then by severity. Red,
    green, the script and the suite go to the server with the words, so the server narrows before it cuts an answer"*;
    the field `result`, `red` or `green`, left out for both): theta's three in the order failed 0.9, failed 0.3, passed
    0.6. 40 passing tests of gamma at 1 and theta's quiet pass (quokka) and quiet failure (wombat) at 0 are set: with
    nothing chosen the answer is cut, no pass comes before a failure, and the quiet failure comes before the passes;
    `result: red` answers failures only, `green` passes only, left out both; theta, or theta's suite, with `green` finds
    the quiet pass; "quokka" finds it; "quokka" with `red` does not; "wombat" with `red` finds the quiet failure.
  - Every variation of every search (Andy: *"every variation of search returns ALL matching records, or AT LEAST
    abucket full!! FOR ALL SEARCHES"*): testicle.search with nothing, a script, a suite, both, result red or green, and
    typed words, alone and together; testicle.red; suite.search with and without a script and words; the runner idle.
    A row matches when it is current, of the script, suite and result asked, and each word is in its title, script or
    suite, in any case. Not cut, the answer holds every matching row; cut, it is full (the room of one answer cannot hold
    one more of its rows) and holds matching rows first, never a row outside the script, suite or result. Page after
    page with from, each page that says more is full, and the pages hold every matching test once.

## What its test must try to break

- A row made at start, or for a file never changed; a row for a file that is no product script.
- A missing suite, or one too many, for a file; a general test's change not reaching every file it judges.
- A hash that does not move with the file; a removal left unmarked.
- An older testicle.db left with its table file, or its rows lost.
- A script.get that makes no rows, makes them unflagged, or answers anything but the file row; an error worded otherwise.
- A suite.search answering another file's rows, a suite twice, or a suite without its status.
- A second row on no flip, a flip without a new row or with its old row lost, a lower severity applied, a search
  answering an old row or another script's or suite's, a passed test before a failed one, an order other than most severe
  first among each, a result filter answering the other result, a from that does not skip, a red holding a passing test; a cut made before the result,
  the script, the suite or the words narrowed, so a quiet row beneath louder ones is never answered.
- Anything later than one second; a busy that never says true while it works, or stays true once idle.
