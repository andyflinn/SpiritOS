# spirit/app/testicle/element/search/suite/rowElement.js — its own test

A suite row of testicle's suite table (goal/G47.1, the UI cycle), with its 🏃‍♂️ (the run cycle). Owed since the rule
*"every production script has its own test"* (goal/G47.1, box v72). The browser file runs in node on a bare window; the
shared row element and the busy button are stand-ins, testicle's interface a recorder of the runs asked.

- It stands at `spirit.element.spirit.app.testicle.element.search.suite.rowElement` with a `create`, and loads the shared row element,
  the busy button and testicle's interface itself.
- `create(row)`: kind `suite`, keyed by the row's key, no actions; fields `run` first (*"The 🏃‍♂️ column is on every row
  ..., the first column"*), then the suite, escaped, then its status.
- The status: *"needs running"* and *"still red"* shown red, *"green"* green; no status, nothing.
- Mounted: the 🏃‍♂️ cell holds a busy button labelled 🏃‍♂️ (*"The button is the busy button exactly as it is"*); a press
  asks `testicle.run { script, suite }` for the row's own; a click on the button never reaches the row's pick; drawn again,
  one button, in the new cell.
- No script (every suite): no button. A node with no testicle: no button, and the refusal never left unhandled.

## What its test must try to break

A run asked without the row's script; the status colours swapped; a press that also picks the row; a stale button drawn
into an old cell.
