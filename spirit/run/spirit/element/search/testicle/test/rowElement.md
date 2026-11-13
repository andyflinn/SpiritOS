# spirit/element/search/testicle/rowElement.js — its own test

A test row of testicle's test table (goal/G47.1, the search cycle), as the testicle list and the detail draw it, on the
shared row element. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The browser
file runs in node on a bare window; the shared row element is a stand-in keeping the spec it is handed.

- It stands at `spirit.element.spirit.element.search.testicle.rowElement` with a `create`, and loads
  `spirit/element/rowElement.js` itself.
- `create(row)`: kind `testicle`, keyed by the row's full key, no actions; rows share one index.
- The box: *"The columns, in this order: the result first, as an icon, ❌ for a failure, ✅ for a success; severity second;
  the title third; then the script name (no path), then the suite name (no path)"*.
- *"its severity, two decimal places, even for 0 and 1 (0.00, 1.00)"*; *"The test title is shown in full"*, escaped.
- *"The script column and the suite column show the file name only, no path; hovering over a script or a suite shows its
  full name as a tooltip"*.

## What its test must try to break

The icons swapped; a severity drawn as `0` or `1`; a path shown in the script or suite cell, or the tooltip lost.
