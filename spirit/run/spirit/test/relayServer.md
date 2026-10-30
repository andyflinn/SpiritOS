# spirit/relayServer.js

The relay's server. This test holds one part of it: how it serves a face its files (goal/G41.3). face/ moved into
shell/, face/shell.js became shell/boot.js, and the relay serves the moved files at their new addresses. The relays run
this code the same day as the nodes (no backward compatibility before alpha).

## Requirements

- Its face files come from shell/ (FACE_DIR), not from face/.
- Its map of addresses to files (FACE_FILES) serves exactly these, each from the moved file:
  `/spirit.js` (face.html's one script tag, the run root's file, goal/G41.19), `/shell.css`, `/shell/boot.js`, `/shell/seal.js`, `/shell/face.css`, `/shell/favicon.svg`, `/shell/login/login.js`,
  `/shell/login/login.json`.
- No address under `/face/` serves a file any more. (The relay's own routes `/face/allowed`, `/face/call`, `/face/file`,
  `/face/stream` and `/face/api` are routes, not files, and stay.)
- Every file the map names is there.
- face.html and spirit.js go out byte for byte as they are on disk (goal/G41.19): nothing pasted in.

## What its test must try to break

- An old address left in the map, and an address naming a file that is not there.
