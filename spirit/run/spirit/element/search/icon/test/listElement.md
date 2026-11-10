# spirit/element/search/icon/listElement.js, the one file it reads

The icons list and the file behind it (goal/G43.11). Its test is `./listElement.js`.

Andy: *"run://spirit/iconSet.json IS the system set now."*. The box: *"A read that is refused is not kept, so a face that gets its star can read it later."* Since goal/G43.32 the set is the fs family's, and followed, no longer a constant (Andy: *"It obviously must require the fs interface so it can listen to changes in the file it loads for it's icon list...."*, which replaces G43.11's *"we make it a constant"*): it is kept in the fs family's cache (`spirit.data.fs.data.icons`), the list draws that branch, and each list watches the fs tree, reading the file again when its row changes, and the fs tree for it coming back after a reconnect.

Asked of a real Chrome on a scratch node's page and on a real face through a real relay. The node holds an Icons app file of its own, with a glyph the set does not have.

## Requirements

- `spirit/iconSet.json` is in git, each glyph with its keywords.
- `shell/json/iconSet.json` is gone, from the tree and from git, and no `.js`, `.html` or `.json` file names it, but for the two tests that check for it.
- The list and the row element do not name the Icons app's file, comments included.
- The list reads `spirit/iconSet.json` through `spirit.fs.loadFile`, and nothing else: no "own, else system". It finds the file's last icon, and not the Icons app's own.
- The list watches the file's row in the fs family's cache, and the fs tree for it coming back after a reconnect.
- The rows stay after the stream connects, and after the node is gone and back with the page open, on the one load.
- A second list on the page has them, and the page has read the file once; after the node is gone and back it is read
  once more, for both lists (spirit.data forgets on a reconnect, the set with it).
- A changed file reaches an open page, on the same load; put back, the glyph it added goes.
- A face with no star is refused, and its list has no rows. Once it has its star, a new list on the same page has the set, and so does a fresh page, through the same read.

## What its test must try to break

- A list still reading the Icons app's file first, or falling back to anything.
- Rows kept where a connect wipes them: they paint, then go. A wipe depends on timing, so the node is stopped and started with the page open.
- A list reading once per list, or more than once more on a reconnect.
- A changed file the open page does not take; a glyph left after the file dropped it.
- A wrapper put on a family before it binds (goal/G43.27: a family binds when first called), which the bound family then
  calls as its own verb for ever, freezing the page: the test binds the fs family before it counts its reads.

The real face's part does not finish today, before goal/G43.32 as after: a face with no star asks `fs.loadFile` and is
never answered, where it should be refused.
- A refusal kept as an empty set.
- A reader left on the old path, or the old file left in place.
