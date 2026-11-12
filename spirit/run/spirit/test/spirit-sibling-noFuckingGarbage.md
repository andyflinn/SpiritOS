# spirit-sibling-noFuckingGarbage.js

No garbage in a test folder (goal/G43.27). Andy: *"fucking wsl now is starting to motherfucking put tests into the run:/
folder that are NOT bound by the fucking product test system: A NEW FUCKING WAY TO INTRODUCE GARBAGE AND STALE
SHIT!!!!!!!!!!!!!!!!!"*, *"wsl: add a general test: spirit-sibling-noFuckingGarbage tests.... thing..."*, and *"wsl:
every test in run:/ MUST MATCH a production file."*

    node spirit/test/spirit-sibling-noFuckingGarbage.js [file]

**Its name is its reach** (`./TEST_SYSTEM.md`): a `-sibling-` test named after `spirit.js` (at `spirit/spirit.js`, beside
this test folder since goal/G43.32) judges every tracked file in a `test/` folder of `spirit/run/` and below, vendor
code left out. `testModule.js` hands it each module in its reach: handed `spirit/spirit.js`, or nothing, it reads
every test folder, so garbage named after no module is told once, under spirit.js; handed another module, the files of
the `test/` folder beside it named after it; handed a file in a test folder, that one.

## Requirements

- **A test folder belongs to a module**: the folder it sits in holds a `.js` module.
- **`spirit/test/`'s tools** (goal/G43.32, Q2; Andy: *"We need special rules for run://spirit/test/  it will be where
  run://spirit/app/test/ finds it's main tools."*): `testReport.js`, `testModule.js` and `headLessChrome.js`, as
  `testModule.js` lists them, and `TEST_SYSTEM.md` are bound there, not tests named after no module.
- **A `test/` inside a `test/` folder** holds the tests of the files beside it, `<name>.js` and its `.md`. Nothing
  else.
- **Every other test matches a production file** (Andy: *"every test must be directly (by name) or indirectly (by
  general rule) be associated with a production file"*): `test/<name>.js`, or a general test `<name>-child-*` or
  `<name>-sibling-*`, of a `<name>.js` beside the folder. A test named after no module is garbage.
- **One test file per script** (goal/G45.1, `./TEST_SYSTEM.md`; Andy: *"there is ONE FUCKING test file in the test folder
  per script file, and every fucking test that applies to that file must be inserted in the that one file"*): a
  `test/<name>-<what>.js` or `.md` beside `test/<name>.js`'s script is red, a second test file of `<name>.js`.
- **A test and its spec together**: a `.js` has its `.md` beside it, and an `.md` its `.js`.
- **Any other file** (a laid page, a fixture) is named after a module beside the folder: `<module>-<what>.<ext>`.
- **Every production script has its own test** (goal/G47.1; Andy: *"spirit-sibling-noFuckingGarbage should also report
  missing tests, and of course run for a specified script file, or all script files"*, *"damn right, every missing
  script-companion-suite is a red at 0.2"*, *"it is ok to exclude the vendored scripts."*): one check, severity 0.2, red
  while a production script (a tracked `.js` in no `test/` folder, vendored code left out) has no `test/<name>.js` beside
  it, its answer naming every such script. Over the whole tree it judges every production script; handed one script,
  that one. Handed a file in a test folder, it is not made.
- Each garbage file is its own check, named by its path, with the reason.
- **Never vacuous**: run over the whole tree, it must have read more than 100 files, or it is red. Handed a file that
  is not in a test folder, it is red.

## What its test must try to break

- A plain test named after no module beside the tools in `spirit/test/`.
- A test in `test/test/` of a file that is not in `test/` (`test/test/oneDoor.js`, before goal/G43.27 deleted it).
- A test named after no module beside its folder (`spirit/app/test/deskMove.js`, before goal/G43.27 renamed it), and a
  `<what>-<more>.js` whose first word is no module beside the folder.
- A `.js` without its `.md`, an `.md` without its `.js`.
- A `test/<name>-<what>.js` of a script that has its one test file, `test/<name>.js`.
- A fixture named after no module (`provider-picker.html`, where there is no `provider.js`).
