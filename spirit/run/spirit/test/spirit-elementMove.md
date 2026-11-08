# spirit-elementMove.js

The move of the elements out of `shell/js` (goal/G43.5). Its test is `./spirit-elementMove.js`. Its lists are what `shell/js` held when the item began.

Andy, box: *"We are ONLY moving the contents of "run://shell/js/" to "run://spirit/element/""*, and *"on the browsers, spirit object, these elements will live in "spirit.element" (SINGLULAR) and not on spirit.elementS!!!!"*

## Requirements

- `shell/js` is gone, and every file it held stands at `spirit/element/` under its own name and folder, its tests and documents with it. *"all elements will keep their name during this move."*
- No code, test or document under `spirit/` names `shell/js`, or reaches a moved element through `spirit.elements`, directly or through a local name for that object. *"both file-location AND the home in spirit.element (singular)"*, *"uncluding tests"*, *"including the contents of shell/ that remains"*, *"including, new code in spirit/app"*.
- The other way round too: no code reaches through `spirit.element` for an element `spirit/element/` does not define. Andy, live: *"contact detail don't load in contacts"*, because `contactDetails` asked `spirit.element` for `navigation`, which stayed on `spirit.elements`.
- Andy's own words are never rewritten: a double-quoted part of a comment or a document is left out of that scan. What the desk writes (`currentGoal.json`, `rules.md`), `agents/` and `design/` are left out too.
- On a real page `spirit.element` exists at start, every moved module loads from its new place, and all the moved elements stand on `spirit.element` and none on `spirit.elements`.
- The library is `spirit/element/codeMirror.js`'s own folder: `spirit/element/test/codeMirror-library.md`. What stays in `shell/shared/` is `shell/shared/js/test/deskRunStatus-home.md`.

## What else proves it

The move must break nothing, and that is the old suites' to say. A file moved is its own suite moved. `spirit/test/word.js` must then fail on `job` alone: `spirit/element/` and `spirit.element` give `element` its home.
