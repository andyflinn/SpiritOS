# spirit/app/testicle/element/search/suite.js — its own test

The suite selector (goal/G47.1, the UI cycle): a thin element over its own list, `./suite/listElement.js`, which it loads
itself (rule/26). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). The world of
`./testicle.js`: a scratch node with testicle on, the general suites stubbed, tests set through `testicle.testicle.set`,
the selector mounted alone on `/face.html` in a real Chrome.

- `create(container, { script, face, placeholder, all, pick })` loads alone through `spirit.require`, appends its own
  root (class `suite-selector`) to the container and answers it, with `destroy` (box v23: *"every element gets a container
  and appends itself"*).
- It loads `spirit/app/testicle/element/search/suite/listElement.js` itself.
- Its list shows the given script's suites and no other's.
- `face`, `placeholder`, `all` and `pick` are handed on: as a dropdown the field shows the placeholder, or the all words;
  a row chosen is handed to `pick`.
- `destroy` takes its root out of the container and lets its list go.

## What its test must try to break

A selector that leaves its list unloaded; an option not handed on; a root left in the container after destroy.
