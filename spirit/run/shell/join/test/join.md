# shell/join/join.js

The Join app (goal/G30.1): the steps a new node takes, from joining a relay to opening its face, drawn as one to-do list
from what the shell hands it (`onSteps`). This test covers what goal/G41.1 (box v19-v20) requires of it.

## Requirements (goal/G41.1)

- **Icons are glyphs** (Andy: the icon set is "the ONLY FUCKING SOURCE OF MOTHERFUCKING ICONS IN FUCKING FACE";
  `spirit/client/iconIndex.js` deleted): its manifest `join.json` names every step's icon as the glyph itself, and its
  own icon too; no key into a table.
- join.js draws a step's icon exactly as join.json gives it, a done step with ☑️, an open one with ⬜, and "Every step is
  done" with ☑️. It reads no icon table (`iconIndex`, `ICON`).

## What its test must try to break

- A step icon given as a key, drawn as nothing.
- A done mark looked up in a table that is gone.
