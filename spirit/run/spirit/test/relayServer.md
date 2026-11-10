# spirit/relayServer.js

The relay's server. This test holds parts of it: how it serves a face its files (goal/G41.3), the face page and a token
in its address (goal/G41.29), and who may post to the face's routes (goal/G41.30). The map, the folder, `faceSend` and
the face page's route are lifted out of the source and run; the posts go to a scratch relay with faces
(`scratchFaceRelay`). The relays run this code the same day as the nodes (no backward compatibility before alpha).

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

## The attacker at the relay's door

goal/G41.30, a section of `./relayServer.js`. The node's doors are `garbage.js`; this is the
relay's. Andy, on the gap: *"The relay's door is not tested yet: there is no scratch relay helper. - close this gap,
dammit!"*

### Requirements

- **A relay of its own** (`spirit/test/headLessChrome.js`, `scratchRelay`): a scratch copy of the tracked files of
  `spirit/run`, a relay identity planted and an owner written as a relay is installed, a face domain
  (`spirit/state/face.json`), `relayServer.js` on a free port with DEBUG on. Never a live relay.
- **Introspect, then throw garbage** (the box: *"1) introspect ... 2) then throw garbage"*): the relay's own api, as its
  garbage list (`/DEBUG/spirit/relay/garbageArguments.json`), each entry an ask's body `{ body: { <verb>: args } }`.
- **Every relay verb takes bad arguments** (the box: *"all servers (node and relay, or serveCommon) are tested by throwing
  malformed paths at them, and malformed, invalid arguments"*): every entry posted to `/api/relay/post` signed by the
  relay's owner, so it passes the door and reaches the verb, and again by a stranger, as anybody may send it; batches of
  20, each followed by a plain request.
- **Raw requests at every door** (*"an attacker trying to crash our servers will throw ANYTHING at the api. Imitate that
  attacker!"*), over a bare socket: at `/api/relay/post`, `/api/relay/reply`, `/api/relay/face/answer` and
  `/api/relay/face/stream`, bodies that are not JSON, JSON that is no object, deeply nested, `__proto__` and
  `constructor` keys, invalid UTF-8, wrong field types, no or a forged signature, signed texts that are not JSON, huge, or
  hold a NUL, no or a wrong Content-Type, a body cut off, one past `BODY_MAX`, a Content-Length past what is sent; at the
  face's routes under a face's host (`/face/api`, `/face/call`, `/face/allowed`, `/face/file`, `/face/stream`); the
  members' stream with garbage signatures and keys; a request line that is not HTTP, a header with no colon.
- **Malformed paths**, GET and POST, at the relay's host and at a face's: climbing, encoded, doubled slashes, very long,
  bad percent-encoding, and NUL bytes last.
- **Passing** (the box: *"the server MUST not CRASH or HANG"*): every answer has a status; no 5xx, but the relay's
  capacity refusal (a 503 saying `retryAfterMs`: *"CAPACITY IS A REFUSAL, NEVER A DROP"*); no failed handler; after
  every batch and every raw request the relay answers a plain request within 3 s; the relay still runs at the end. A held
  request (a body cut off, a stream) may be held, as long as the relay answers everybody else.
- The number of asks is said up front.

- **One header must not crash the relay** (goal/G41.30, the review, RH3: *"clamp the status to an integer from 100 to 599
  (else 502), and wrap faceAnswer and faceFeed in try/catch"*; Andy: *"yes."*). On a scratch relay with a face, a member
  answers his own face's call, signed, with `x-spirit-status` 99, 1000, abc, -1, 0, 600 and 1.5: the relay goes on, and the
  viewer gets 502. A bad `x-spirit-type` leaves it running too. A good status, 201, still reaches the viewer as it is.

### What its test must try to break

- A relay killed, or left unanswering, by any one request or batch: each is its own check, named by what was sent.
- A 5xx or a failed handler for garbage.

### Known

- A stranger's asks are mostly refused 429 by the relay's address table before they reach a verb; the owner's reach it.
