# persona/

`spirit/run/process/js/agent/table/persona/` is the persona table (goal/G41.4). Its test is `./persona.js`. What every
table shares is specified in `../../test/`.

Andy, box v22: *"a persona table. keyed by ID same as the shadow-roll (with Label and Description, and a
codeMirror-field for the persona-description i give it with every prompt)"*.

## Requirements

- It has `server.js`, `elementTable.js` and `elementRow.js`.
- `server.js(ctx)` makes the `persona` table on `ctx.db` with the shared rowTable. Its columns are the key set, the
  icon, label and description, then `persona`, and nothing else.
- `persona` is its text, kept as typed, lines and all. A set of another field keeps it.
- A persona deleted takes no grants: grants are a job's.
- `elementTable.js` registers `spirit.elements.personaTable.create(container, api, detail)`:
  - It requires the shared element and its own `elementRow.js`.
  - It builds on `agentTable` for the persona table, with the shared Add.
  - A row it opens is a `personaRow`.
- `elementRow.js` registers `spirit.elements.personaRow.create(container, api, id, added, detail)`:
  - It builds on `agentRow` with the persona table's look.
  - Its fields are the label, the description, and the persona in a CodeMirror editor.

## What its test must try to break

- A persona text that loses its lines, or is emptied by a set of its label.
- The persona edited in a one-line field.
