# shell/shared/js/deskDoorFields.js

A stack-frame door's four fields, one copy for every form that holds them (goal/G27.2): the Stacks pane's add form and
the door dialog's edit form. The forms are Andy's (goal/G22.3's box, 2026-10-13): the gate is narrow, one function, and
a whole module named as the gate is cheating; the endpoint is wide, a whole module or Node's own. Read from the
module's code (goal/G41.11).

## API

`window.spirit.elements.deskDoorFields`:

- `FIELDS` gate, endpoint, paths, suites.
- `html(pre)` the four framed blocks (class `sfc-field`, inline blocks): each a meaning line `pre+f-says`, an input
  `pre+f` carrying `data-field`, and a wrong line `pre+f-left`.
- `why(pre, field)` what is wrong with one field, `''` when it may be sent.
- `check(pre, buttonId)` writes each field's meaning and what is wrong; the button off while any is wrong; answers
  whether all are right.
- `door(pre)` `{ gate, endpoint, paths, suites }` as typed: trimmed, the lists split on commas, the empty dropped.
- `fill(pre, door)` puts a door's values in the form, lists joined by `, `; no door empties it.

## Requirements

- **The gate**: empty is not wrong yet; a whole module is "cheating", naming the `::<function>` to write; anything
  but `spirit/run/<file>.js::<function>` is refused.
- **The endpoint**: a whole module `spirit/run/<file>.js`, or `node:` with kinds from http, https, fetch joined by
  `+` (an unknown kind named); one function (`::`) is refused; empty is not wrong yet.
- **Paths**: a `node:` endpoint needs them; a module takes none; each starts with `/` and holds no space.
- **Suites**: file names `<name>.js`, no folder, each named once; none is not wrong.
- Every field longer than 256 characters is refused with its length.
- A right field's meaning line says what it means (the gate's function and module, every function of a module,
  Node's own calls, the requests watched, the suites run); an empty or wrong one says what goes in it.

## What its test must try to break

- A whole module accepted as the gate; a `::` endpoint accepted; a `node:` kind outside the three.
- Paths on a module, none on a `node:` endpoint; a folder in a suite; a suite twice.
- A wrong field leaving the button on; a right form leaving it off.
- `door` handing back untrimmed values or empty list entries; `fill` leaving old values behind.
