# No family writes its folder, a core file least of all

goal/G43.23, item 1, and goal/G43.20. Its test is `./introSpector.js`: a real node on a scratch copy of the
tracked files, asked as the owner at its own loopback door, the desk app turned on for it.

The box of goal/G43.23: *"core files unprotected: a family's FS.saveFile / deleteFile (introSpector.js) never asks
fileWritable, so it can overwrite any api.js or app code (G30.21)."* goal/G43.20 took the FS set off every branch (Andy:
*"those owner only FS verbs are no longer needed, because not the api ID spirit.fs or spirit.api.desk ARE the path to all
those files"*), so a branch's files are written through `spirit.fs` alone, behind `fileWritable`.

## Requirements

- No branch of the node's tree holds an `FS.` verb.
- `<family>.FS.saveFile` and `<family>.FS.deleteFile` on a core file of its folder (`spirit/contact/api.js`,
  `spirit/app/api.js`, `spirit/app/desk/desk.json`, an app's own json being core whatever it says) are refused, and the
  file is left as it was.

## What its test must try to break

- An FS verb left on a branch.
- A core file changed through a family.
