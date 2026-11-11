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
  narrow them; another file's search answers none of the first's.

- **The rename** (goal/G47.1; Andy: *"this cycle will rename the \"file\" table to \"script\""*): the first table is
  `script`, the suite table's key column `script`; an older testicle.db, its table `file` and its suite column `file`,
  is renamed in place at start, its rows kept as they were, and no table `file` is left.

- **The test table, test.set, test.search and testicle.red** (goal/G47.1, the test cycle). The table is goal/G45.1's:
  script, suite, test, flipped, current, verified, tested, judged, severity.
  - *"Every test.set happens by itself, no bundling"*, *"test.set MUST carry severity: {script, suite, test, verified,
    severity}"*. A set for a script with no row makes its script row and a suite row for every suite that concerns it.
    A test set for the first time has one row, current, with its result, its severity, flipped and tested now, judged
    at the script's hash.
  - *"If the test does not flip, the current row is only updated with the last checked date, and, if it exists, the hash
    of the product file"*: no new row; tested moves, flipped stays; after the script changes, judged is its new hash.
    *"The server applies the severity to the row only if the new severity is higher than the old one"*: a lower one
    leaves it, a higher one is applied.
  - *"If the test flips, a new active row is created; this will keep change history"*: two rows, one current with the
    new result; the replaced row kept, current no longer. (The severity a flipped row starts with is not asserted: the
    box does not say whether it takes the replaced row's when that is higher.)
  - *"This cycle does not clear a suite's needs-testing flag"*: with every test passing, the flag stays.
  - *"test.search will only return \"current\" test rows for the script/suite combination supplied ... no script in the
    search query searches tests for any script; the same for suite"*: `{items, more}`, the current rows only, one per
    test; with no script, that suite's for any script; with no suite, that script's in any suite; with neither, all.
    *"Most severe first applies to all test searches."*
  - *"The verb red is testicle.red"*, *"search all failed, current tests, most severe first"*: every failed current test,
    no other, most severe first.

## What its test must try to break

- A row made at start, or for a file never changed; a row for a file that is no product script.
- A missing suite, or one too many, for a file; a general test's change not reaching every file it judges.
- A hash that does not move with the file; a removal left unmarked.
- An older testicle.db left with its table file, or its rows lost.
- A script.get that makes no rows, makes them unflagged, or answers anything but the file row; an error worded otherwise.
- A suite.search answering another file's rows, a suite twice, or a suite without its status.
- A second row on no flip, a flip without a new row or with its old row lost, a lower severity applied, a search
  answering an old row or another script's or suite's, an order other than most severe first, a red holding a passing test.
- Anything later than one second; a busy that never says true while it works, or stays true once idle.
