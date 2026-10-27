# shell/desk/desk.js

The Desk app's page: the List of goals and items, the rules, the group chat. This test covers what goal/G41.1
(box v19-v20) requires of it.

## Requirements (goal/G41.1)

- **Icons are glyphs** (Andy: the icon set is the only source of icons on the face; `spirit/client/iconIndex.js`
  deleted): every icon desk.js draws is written as the glyph itself: a goal's 📁, an item's ❌ while it asks Andy and
  💻 otherwise, the battle mark ⚔️, and a rule's status (proposed ✏️, active 🔒, deleted 💀).
- It reads no icon table (`iconIndex`, `ICON`) and has no lookup of a name into one (`deskIcon`).

## What its test must try to break

- An icon looked up by key, drawn as nothing once the table is gone.
