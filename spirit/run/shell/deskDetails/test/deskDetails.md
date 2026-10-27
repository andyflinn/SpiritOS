# shell/deskDetails/deskDetails.js

An item's details page in the Desk app: the box, the suites, the red Qs, the blocks, the files and the rules, each a
panel behind an icon on its left strip. This test covers what goal/G41.1 (box v19-v20) requires of it.

## Requirements (goal/G41.1)

- **Icons are glyphs** (Andy: the icon set is the only source of icons on the face; `spirit/client/iconIndex.js`
  deleted): each panel of `DD_PANELS` names its icon as the glyph itself, and the strip draws it as it is.
- It reads no icon table (`iconIndex`, `ICON`).

## What its test must try to break

- A panel icon given as a key, drawn as `undefined` once the table is gone.
