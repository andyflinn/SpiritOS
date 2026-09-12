# The POST API — route hierarchy

Measured at `7734ecc`. Every POST route both servers dispatch, and the
function each one lands in. Illustration only: no argument, no proposal,
nothing about what should change.

One file, [`spirit/run/js/server.js`](../../spirit/run/js/server.js),
serves both. Which server you get is `--relay` on the command line.

---

## The relay — `node server.js --relay`

Binds `0.0.0.0`. Every path not on the allowlist
(`isRelayPublicPath`, [server.js:682](../../spirit/run/js/server.js#L682))
is 404 before dispatch, so this is the whole POST surface.

```
POST /api/relay/
  ├── claim                 handleRelayClaim   → relay.claim
  ├── invite                handleRelayInvite  → relay.mint
  ├── remove-peer           (inline)           → relay.removePeer
  │
  ├── post                  (inline)           → relay.routePost
  ├── reply                 (inline)           → relay.routeReply
  ├── send                  handleRelaySend    → relay.send
  │
  ├── device                handleDeviceOffer  → relay.deviceOffer
  └── set-device            handleSetDevice    → relay.setDevice
```

Eight routes. All of `relay.js`.

---

## The personal server — `node server.js`

Binds `127.0.0.1`, and refuses anything that is not loopback with a valid
`Host` before dispatch ([server.js:723](../../spirit/run/js/server.js#L723)).
So this whole surface is reachable from the browser on this machine and
from nowhere else.

```
POST /api/hub/
  ├── claim                 hub.handleClaim
  ├── peer                  hub.handlePeer
  ├── invite                hub.handleInvite
  │
  ├── post                  (inline)           → peerRouter.post
  ├── send                  hub.handleSend
  │
  ├── contact               hub.handleContact
  ├── unknown-senders       hub.handleUnknownSenders
  └── rotate-password       hub.handleRotatePassword

POST /api/fs/
  ├── save                  handleFsSave
  ├── save-app-script       handleFsSaveAppScript
  ├── save-app-manifest     handleFsSaveAppManifest
  ├── delete                handleFsDelete
  └── annotate              handleFsAnnotate

POST /api/jobs
  ├── (none)                handleCreateJob
  ├── <id>                  handleJobUpdate
  └── <id>/cancel           handleCancelJob

POST /api/proxy             handleGenericProxy

POST /                      "POST accepted"
```

Eight `/api/hub/`, five `/api/fs/`, three `/api/jobs`, one `/api/proxy`.

Anything else under POST is `405`.

---

## One structural note

`/api/relay/*` is **not** relay-only in code. The relay object is built
unconditionally at [server.js:15](../../spirit/run/js/server.js#L15), and
the eight relay routes above are dispatched in the same `if (req.method
=== 'POST')` block as the hub routes. On a personal node they are
therefore live — behind the loopback gate, like everything else it
serves.

What separates the two servers is not which handlers exist. It is which
ones the door lets a request reach.
