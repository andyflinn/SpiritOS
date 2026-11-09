# spirit/app/icons/nodeIcons.js, the icon set's node half

Its test is `./nodeIcons.js`. The box (goal/G43.19, v16): *"./node<Name>.js will maintain the table (run://spirit/state/icons/data/iconSet.json)"*, *"it is initialized from run://spirit/iconSet.json when it does not exist yet"*, *"only ./nodeIcons.js writes the table"*; 9: *"two saves never write iconSet.json at once"*; 10: it publishes on the job `spirit.app.icons`. Andy, of a duplicate: *"the icon app allowed me to add a duplicate icon.... that shouldn't work"*.

Raw calls to a scratch node with Icons switched on, `icons.icon` with the ops its `api.js` names; what was written is read from the disc. Glyphs the system set does not hold are taken from the pictograph blocks by code point.

## Requirements

- With no own set, search answers the system set, each item's label a row `{ glyph, keywords }`; get answers an icon with its keywords, or `row: null`; search by a keyword finds its icon. None of these writes the set.
- The first add begins the own set from the system set, every system icon in it, the new icon on top with its keywords; `spirit/iconSet.json` is not written; no half-written file is left.
- A duplicate answers `added: false` and names the icon, under either spelling of its invisible selector, and the set is not written.
- set writes new keywords; set of an icon not there changes and adds nothing. delete takes an icon out; delete of an icon not there changes nothing; a system icon deleted from the own set stays in the system set.
- Eight adds at once all answer added and all land; the rest of the set stands, whole JSON.
- The job `spirit.app.icons` holds a row a run published the moment the add has answered.

## What its test must try to break

- Crooked calls (no op, an unknown op, no glyph, an empty or blank glyph, a glyph that is a number, keywords that are no list or not text, an extra argument) are refused, and the set is as it was.
- A set of 4000 icons: a search answers some, with more, within one answer.
