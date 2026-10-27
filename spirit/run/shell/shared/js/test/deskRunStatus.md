# shell/shared/js/deskRunStatus.js

The verifier's run in an item's status (goal/G33.6, bringing back goal/G18.5's status box; Andy, 2026-10-23: "why do
i no longer see the verifier run in the items status column?"). One rendering for the List row's status and the
item's dialog. Read from the module's code (goal/G41.11).

## API

`window.spirit.elements.deskRunStatus(facts, run, esc)` answers HTML, or `''`.

## Requirements

- **A run of this item** (`facts.verifyRunning === true` and `run.doing === 'run'`): a `<progress max="100">` 6em wide,
  its value `((index - 1) + tests/expected) / of`, the suite part held at 1 and the whole held between 0 and 100; then
  `verifying <suite's file name>, suite <index> of <of>`. No `of`: 0% and no "suite i of n"; no suite, no name. The
  suite's name goes through `esc`; without `esc` it is drawn as it is.
- **Otherwise the ended outcome** (goal/G33.7): `verified green` in green; `red: N suites` in red, N from
  `verifyRed`, or, for an older row, the distinct first words (suites) of `verifyFailures`; singular for one.
- No facts, or neither green nor red: `''`.

## What its test must try to break

- A progress past 100 or below 0; tests past expected counting as more than one suite.
- A run shown for an item the desk does not say is running, or for a publish that is not a run.
- A suite name drawn unescaped when `esc` is handed; a red count that counts a suite twice.
