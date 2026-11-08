# spirit-sibling-noFuckingGarbage.js

No garbage in a test folder (goal/G43.27). Andy: *"fucking wsl now is starting to motherfucking put tests into the run:/
folder that are NOT bound by the fucking product test system: A NEW FUCKING WAY TO INTRODUCE GARBAGE AND STALE
SHIT!!!!!!!!!!!!!!!!!"*, *"wsl: add a general test: spirit-sibling-noFuckingGarbage tests.... thing..."*, and *"wsl:
every test in run:/ MUST MATCH a production file."*

    node test/spirit-sibling-noFuckingGarbage.js [file]

**Its name is its reach** (`./TEST_SYSTEM.md`): a `-sibling-` test named after `spirit.js` (at `spirit/spirit.js`, found
there for the run root's test folder) judges every tracked file in a `test/` folder of `spirit/run/` and below, vendor
code left out. `testModule.js` hands it each module with its own test: handed `spirit/spirit.js`, or nothing, it reads
every test folder, so garbage named after no module is told once, under spirit.js; handed another module, the files of
the `test/` folder beside it named after it; handed a file in a test folder, that one.

## Requirements

- **A test folder belongs to a module**: the folder it sits in holds a `.js` module. The run root is the exception.
- **The run root's `test/`** holds its general tests (`spirit-child-*`, `spirit-sibling-*`, of `spirit/spirit.js`), its
  helpers (`headLessChrome.js`, `testModule.js`, `testReport.js`) and `TEST_SYSTEM.md`. Nothing else.
- **A `test/` inside a `test/` folder** holds the tests of the files beside it, `<name>.js` or `<name>-<what>.js` and
  their `.md`. Nothing else.
- **Every other test matches a production file** (Andy: *"every test must be directly (by name) or indirectly (by
  general rule) be associated with a production file"*): `test/<name>.js`, a test by name `test/<name>-<what>.js`
  (`testModule.js` runs it with `<name>.js`), or a general test `<name>-child-*` or `<name>-sibling-*`, of a `<name>.js`
  beside the folder. A test named after no module is garbage.
- **A test and its spec together**: a `.js` has its `.md` beside it, and an `.md` its `.js`.
- **Any other file** (a laid page, a fixture) is named after a module beside the folder: `<module>-<what>.<ext>`.
- Each garbage file is its own check, named by its path, with the reason.
- **Never vacuous**: run over the whole tree, it must have read more than 100 files, or it is red. Handed a file that
  is not in a test folder, it is red.

## What its test must try to break

- A plain test in the run root's `test/` (`test/caches.js`, before goal/G43.27 moved it).
- A test in `test/test/` of a file that is not in `test/` (`test/test/oneDoor.js`, before goal/G43.27 deleted it).
- A test named after no module beside its folder (`spirit/app/test/deskMove.js`, before goal/G43.27 renamed it), and a
  `<what>-<more>.js` whose first word is no module beside the folder.
- A `.js` without its `.md`, an `.md` without its `.js`.
- A fixture named after no module (`provider-picker.html`, where there is no `provider.js`).
