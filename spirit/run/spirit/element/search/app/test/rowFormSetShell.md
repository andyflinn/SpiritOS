# spirit/element/search/app/rowFormSetShell.js — its own test

The node's shell, at home or on its face, one rowForm (goal/G43.18, box v29, "The shell"; the RULE: *"a shell must be able
to replace itself"*). Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). A real
Chrome on a scratch node's face page; which apps may be a shell is read from the tree (`shell.true`), what the node keeps
from the scratch node's `spirit/state/shell.json`.

- It loads through `spirit.require` and stands at `spirit.element.spirit.element.search.app.rowFormSetShell`;
  `create(host, { key, at })` answers `{ destroy }`.
- *"shown only for an app whose <name>.json says shell:true:true"*: no row for an app that may not be a shell.
- At home `[🏡] "Home shell" ... [Set]`, on its face `[😋] "Face shell" ... [Set]`, one row each.
- Beside the dropdown, the shell the node names now, by its label, asked of `node.shell({ at })`.
- *"Both dropdowns list only the apps whose <name>.json says shell:true:true"*.
- Set with nothing chosen asks nothing and says *"Choose a shell first."*; a pick is held until Set; Set is an arming
  button, its first press asks nothing, its second `node.shell({ at, name })`, and the node keeps it; a refusal is said in
  the row (*"Not set: ..."*).
- `destroy` leaves its host empty.

## What its test must try to break

A row for a non-shell; the face row drawn or set as home; a non-shell offered in the dropdown; a Set with nothing chosen
that passes silently; a pick sent before Set.
