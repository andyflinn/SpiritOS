# spirit/app/testicle/testicle.js

testicle's server (goal/G47.1, the server cycle): it keeps the first two tables of testicle.db, `file` and `suite`, in
sync with run:// by itself. Its test is `./testicle.js`. The tables' columns are goal/G45.1's box.

## Requirements

The box, in Andy's words where he gave them:

- *"The server mounts beside the face (testicle.json: node.mount true); testicle.db sits in testicle's state folder"*:
  `node.mount` true, `mount` naming `testicle.js` beside `element.js`; `spirit/state/testicle/data/testicle.db`.
- *"The server has no verb this cycle: it syncs by itself and nobody asks it"*: the node serves no `testicle.*` verb.
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

## What its test must try to break

- A row made at start, or for a file never changed; a row for a file that is no product script.
- A missing suite, or one too many, for a file; a general test's change not reaching every file it judges.
- A hash that does not move with the file; a removal left unmarked.
- Anything later than one second.
