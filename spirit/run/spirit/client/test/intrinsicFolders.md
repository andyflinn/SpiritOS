# The old shell asks for no missing app

goal/G43.23, item 13. Its test is `./intrinsicFolders.js`: a real Chrome loads the old shell (the node's `/`, `spirit/shell/index.html`, which loads `spirit/client/shell.js`) from a scratch node, and every answer the page got is read.

The box: *"the old shell's INTRINSIC_APP_FOLDERS (client/shell.js) still lists stats, apps, contacts, icons: four 404s on every load."*

## Requirements

- Every folder `INTRINSIC_APP_FOLDERS` names is there, as `shell/<folder>/`.
- Loading the old shell asks for no missing app: no `shell/<folder>/<folder>.json` of a folder it names answers anything but 200.
