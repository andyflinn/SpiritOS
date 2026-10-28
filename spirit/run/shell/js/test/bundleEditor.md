# bundleEditor.js

`spirit/run/shell/js/bundleEditor.js` is the panel that makes and keeps bundles (goal/G41.13). Andy, box v7: *"A shell
element (panel and page) creates and maintains bundles: lists them, adds one, edits its label, description and paths,
and deletes one."* Its test is `./bundleEditor.js`.

## Requirements

- It registers `spirit.elements.bundleEditor.create(container, { api })`, which answers `{ destroy }`.
- It lists the node's bundles in a `probabilitySearch`, the shell's standard search, searched as it is made, asking
  `auth.bundle { op: 'search', text }`.
- It has an Add button. Add opens an empty editor (label, description, the path picker, Save) and asks the node
  nothing: nothing is written before Save.
- Paths are picked with the shell's api-branch selector, `createApiBranchSelector` (*"this shell element will use the
  standard family and verb pickers that already exist"*): a family, or a single verb.
  - Each path added shows with its own remove button.
  - A path already there, or none picked, adds nothing.
  - A path's remove button takes it off.
- Save goes through the spirit object:
  - a new bundle asks `auth.bundle { op: 'add', label, description, paths }`;
  - a bundle picked asks `{ op: 'set', id }` with what changed, and the whole new path list when the paths changed.
  - A refused Save says the node's refusal.
- A bundle picked from the list opens with its label, description and paths.
- Delete asks `auth.bundle { op: 'delete', id }`.
- After a change the list asks again.
- `destroy` destroys its list and empties its box.

Its parts are found by the end of their ids, as the agent tables' are: `-add`, `-label`, `-description`, `-path` (the
picker's box), `-addpath`, `-save`, `-delete` and `-note`. A path shown carries its remove button as
`data-path="<path>"`.

## What its test must try to break

- An Add that writes a bundle before Save.
- A path added twice, or an empty pick added.
- A Save of a picked bundle that sends what did not change, or a path list merged instead of replaced.
- A refusal swallowed.
