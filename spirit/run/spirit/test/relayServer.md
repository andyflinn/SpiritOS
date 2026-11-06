# spirit/relayServer.js

The relay's server. This test holds one part of it: how it serves a face its files (goal/G41.3). face/ moved into
shell/, face/shell.js became shell/boot.js, and the relay serves the moved files at their new addresses. The relays run
this code the same day as the nodes (no backward compatibility before alpha).

## Requirements

- Its face files are read from the run root (FACE_DIR), each from its file: the addresses stay, the files moved under
  `spirit/` (goal/G43.18, Q25, Andy: *"the browser should see them the same."*), each served from `serveCommon.pageFile`.
- Its map of addresses to files (FACE_FILES) serves exactly these (box v29: *"The relay serves a logged-out face one plain
  page, the one-field form, with spirit.js and seal.js only"*): `/spirit.js` (face.html's one script tag, goal/G41.19),
  `/shell/seal.js` and `/shell/favicon.svg`. No boot.js, sheet or login app.
- No address under `/face/` serves a file any more. (The relay's own routes `/face/allowed`, `/face/call`, `/face/file`,
  `/face/stream` and `/face/api` are routes, not files, and stay.)
- Every file the map names is there.
- face.html and spirit.js go out byte for byte as they are on disk (goal/G41.19): nothing pasted in.
- **The face page takes no token from its address** (goal/G41.29; the box: *"The login-email must not carry a link"*):
  asked with `/?<token>`, the page at `/` or `/face.html` serves face.html and logs nobody in: no `faceLogin`, no login
  cookie. The token is pasted into the Log in field only.
- **Only the face's own page posts to its /face/ routes** (goal/G41.30, the review, RC2: *"on every /face/* POST, require
  Origin equal to the face's own host, require the session's name to match faceAt(host).name, and require Content-Type:
  application/json"*; Andy: *"yes."*). On a scratch relay with two faces, present and logged in: `POST /face/call` with an
  Origin of another face, with no Origin, as text/plain, or with another member's session is refused, a 4xx, and no face
  event reaches any node. `POST /face/api` with an Origin of another face is refused too. The face's own page, its Origin
  and json, still reaches both.

## What its test must try to break

- An old address left in the map, and an address naming a file that is not there.
- A token in the face page's address that still logs in.
- A page on another member's face driving this member's node.
