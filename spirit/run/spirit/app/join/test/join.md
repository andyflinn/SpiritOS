# spirit/app/join/join.js

The Join app (goal/G43.26; Andy: *"JOIN IS A FUCKING APP"*): a wrapper mounted the new shell's way, as Info is. All of
Join is joinList (`spirit/element/joinList.js`, tested in `spirit/element/test/joinList.js`, which draws the steps); its
steps are its manifest's, `join.json`.

    spirit.element.spirit.app.join.join.create(container, {}) -> { destroy() }

Its test is `./join.js`, on a bare window: joinList is a stand-in put on the page only once the app requires it.

## Requirements

- **Icons are glyphs** (goal/G41.1): `join.json` names every step's icon as the glyph itself, and its own icon
  (`identity.icon`) too; no key into a table, and join.js names no icon table (`iconIndex`, `ICON`).
- It places itself at `spirit.element.spirit.app.join.join`; no `spirit.shell.activateApp`, the old shell's way.
- It requires `spirit/element/joinList.js` and nothing else, empties its container and makes joinList in it.
- Destroy destroys joinList and empties its container; destroyed before joinList loads, nothing is made.
- joinList refused, it says "Join could not be loaded."

## What its test must try to break

- A step icon given as a key, drawn as nothing.
- A wrapper that draws or asks anything of its own, or mounts through the old shell.
- joinList made after destroy.
