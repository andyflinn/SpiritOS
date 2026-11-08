# A family's FS may not write a core file

goal/G43.23, item 1. Its test is `./introSpector-coreWrite.js`: a real node on a scratch copy of the tracked files, asked as the owner at its own loopback door, its family FS verbs (introSpector.js) on a node family's folder and on an app's (desk, turned on for it).

The box: *"core files unprotected: a family's FS.saveFile / deleteFile (introSpector.js) never asks fileWritable, so it can overwrite any api.js or app code (G30.21)."* Andy (G30.21): *"only "core" files are write-protected"*, *"any non-core file is fair game"*.

## Requirements

- `<family>.FS.saveFile` on a core file of its folder (`spirit/contact/api.js`, `spirit/app/api.js`, `spirit/app/desk/desk.json`, an app's own json being core whatever it says), one `fileWritable` refuses, is refused and the file is left as it was.
- `<family>.FS.deleteFile` on the same file is refused and the file is still there.
- A file of a family folder that `fileWritable` lets be written (one in `spirit/app/desk/`) still saves through `FS.saveFile`, and `FS.deleteFile` deletes it.
