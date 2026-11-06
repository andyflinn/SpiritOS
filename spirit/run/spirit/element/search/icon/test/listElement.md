# spirit/element/search/icon/listElement.js, the one file it reads

The icons list and the file behind it (goal/G43.11). Its test is `./listElement.js`.

Andy: *"run://spirit/iconSet.json IS the system set now."*, and Q5: *"we make it a constant, that way i cannot change, and leave code that reads it hanging"*. The box: *"A page reads the file once and holds it where a stream connecting does not wipe it."*, *"Andy's commit shows after a page reload."*, *"A read that is refused is not kept, so a face that gets its star can read it later."*

Asked of a real Chrome on a scratch node's page and on a real face through a real relay. The node holds an Icons app file of its own, with a glyph the set does not have.

## Requirements

- `spirit/iconSet.json` is in git, each glyph with its keywords.
- `shell/json/iconSet.json` is gone, from the tree and from git, and no `.js`, `.html` or `.json` file names it, but for the two tests that check for it and the desk's generated `currentGoal.json`.
- The list and the row element do not name the Icons app's file, comments included.
- The list reads `spirit/iconSet.json` through `spirit.fs.loadFile`, and nothing else: no "own, else system". It finds the file's last icon, and not the Icons app's own.
- Nothing watches the file.
- The rows stay after the stream connects, and after the node is gone and back with the page open, on the one load.
- A second list on the page has them, and the page has read the file once.
- A changed file does not reach an open page. After a reload it does.
- A face with no star is refused, and its list has no rows. Once it has its star, a new list on the same page has the set, and so does a fresh page, through the same read.

## What its test must try to break

- A list still reading the Icons app's file first, or falling back to anything.
- Rows kept where a connect wipes them: they paint, then go. A wipe depends on timing, so the node is stopped and started with the page open.
- A list reading once per list, or again on a reconnect.
- A refusal kept as an empty set.
- A reader left on the old path, or the old file left in place.
