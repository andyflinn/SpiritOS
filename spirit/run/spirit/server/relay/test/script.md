# spirit/server/relay/script.js

The relay's server. This test holds parts of it: how it serves a face its files, the face page and a token in its
address (goal/G41.29), and who may post to the face's routes (goal/G41.30). A scratch relay with a face and a scratch node
are asked the same addresses; the posts go to a scratch relay with faces (`scratchFaceRelay`). The relays run this code
the same day as the nodes (no backward compatibility before alpha).

## Requirements

- **The same static rule as the node, and no list** (goal/G49.15, box v16: *"the static file serving logic should be the
  exact same on the relay as it is on the node"*; *"the relay list goes."*): no FACE_FILES. Each address asked is answered
  as the node answers it, the same status and the same bytes where it serves: `/spirit/script.js`, the seal, the boot,
  `spirit/shell/shell.css` and codeMirror's library served; `spirit/state/identity.json`, the relay's own code,
  `spirit/fs/fileSystem/script.js` and the relay's own `spirit/state/face.json` refused; face.html at `/`.
- **The face page takes no token from its address** (goal/G41.29; the box: *"The login-email must not carry a link"*):
  asked with `/?<token>`, the page at `/` serves face.html and sets no login cookie. The token is pasted into the Log in field only.
- **Only the face's own page posts to its /face/ routes** (goal/G41.30, the review, RC2: *"on every /face/* POST, require
  Origin equal to the face's own host, require the session's name to match faceAt(host).name, and require Content-Type:
  application/json"*; Andy: *"yes."*). On a scratch relay with two faces, present and logged in: `POST /face/call` with an
  Origin of another face, with no Origin, as text/plain, or with another member's session is refused, a 4xx, and no face
  event reaches any node. `POST /face/api` with an Origin of another face is refused too. The face's own page, its Origin
  and json, still reaches both.

## What its test must try to break

- A list of files of its own, and an address it answers otherwise than the node.
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
  malformed paths at them, and malformed, invalid arguments"*): every entry posted to `/spirit/relay/post` signed by the
  relay's owner, so it passes the door and reaches the verb, and again by a stranger, as anybody may send it; batches of
  20, each followed by a plain request.
- **Raw requests at every door** (*"an attacker trying to crash our servers will throw ANYTHING at the api. Imitate that
  attacker!"*), over a bare socket: at `/spirit/relay/post`, `/spirit/relay/reply`, `/spirit/relay/face/answer` and
  `/spirit/relay/face/stream`, bodies that are not JSON, JSON that is no object, deeply nested, `__proto__` and
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

## The route caching goes (goal/G47.1, box v69)

*"A post carries no hints: the node sends none, the hint signature goes, and the relay takes a post with hints no
more."* Two scratch relays (a stranger's second post within its minute is held by its address, 429, which is no refusal
of hints): a signed card ask posted as it is is taken (200); the same with hints and a hint signature beside it is
refused as a bad request (400).

## A forged signature is refused, not merely survived (goal/G47.6)

The box: *"a packet with a faked signature is refused by the relay with a refusal, not merely that the relay does not
crash."* A post claiming to be from the relay's own owner, with a real signature by that owner over another text, is answered
with a 4xx at /spirit/relay/post, /spirit/relay/reply, /spirit/relay/face/answer and /spirit/relay/face/stream.

## The relay says it is one, first (goal/G49.25)

The box: *"spirit.server.relay sets spirit.IS_RELAY to true imediately after spirit/script.js is loaded, before spirit.fs is
used."* In the relay's code, comments left out, the statement right after its require of spirit/script.js is
`spirit.IS_RELAY = true;`, and it sets the flag nowhere else.
