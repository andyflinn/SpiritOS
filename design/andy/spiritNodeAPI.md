# The node API — route hierarchy

Measured at `e52a8ac`, 2026-09-13. Every route both servers dispatch and
the function it lands in. Illustration only: no argument, no proposal,
nothing about what should change.

One file, [`spirit/run/js/server.js`](../../spirit/run/js/server.js),
serves both. Which server you get is `--relay` on the command line.

**Changed since the first version of this page** (which was POST only, at
`7734ecc`): `/api/hub/post` has a handler instead of being written out in
the route table; `/api/hub/arrivals` is new; both `/api/fs/save-app-*`
routes are gone. The GET side is included now, because the two halves of
one idea — post to a peer, find out what arrived — sit on opposite sides
of the method.

---

## The relay — `node js/server.js --relay`

Binds `0.0.0.0`. Every path not on the allowlist
(`isRelayPublicPath`, [server.js:693](../../spirit/run/js/server.js#L693))
is 404 before dispatch, so this is the whole surface.

```
POST /api/relay/
  ├── claim                 handleRelayClaim   → relay.claim
  ├── invite                handleRelayInvite  → relay.mint
  ├── remove-peer           (inline)           → relay.removePeer
  │
  ├── post                  (inline)           → relay.routePost
  ├── reply                 (inline)           → relay.routeReply
  ├── send                  handleRelaySend    → relay.send          ← the ring
  │
  ├── device                handleDeviceOffer  → relay.deviceOffer
  └── set-device            handleSetDevice    → relay.setDevice

GET  /api/relay/
  ├── who                   handleRelayWho     → relay.who           ← public census
  ├── status                handleRelayStatus  → relay.status        ← owner-signed
  ├── inbox                 handleRelayInbox   → relay.inbox         ← the ring
  └── stream                (inline)           → relay.streamOpen    ← the held wire

GET  /api/version                                                    ← public
```

Eight POST, four GET, plus `/api/version`. All of `relay.js`.

**`relay` is no longer an addressable destination.** It is still a
reserved name nobody may claim and no invite may be labelled with — a
namespace rule that outlived the console it used to serve.

---

## The personal server — `node js/server.js`

Binds `127.0.0.1`, and refuses anything that is not loopback with a valid
`Host` before dispatch ([server.js:736](../../spirit/run/js/server.js#L736)).
So this whole surface is reachable from the browser on this machine and
from nowhere else.

```
POST /api/hub/
  ├── claim                 hub.handleClaim
  ├── peer                  hub.handlePeer              ← whoBook only, never the WAN
  ├── invite                hub.handleInvite
  │
  ├── post                  hub.handlePost              ← the router
  ├── send                  hub.handleSend              ← the ring
  │
  ├── contact               hub.handleContact
  ├── unknown-senders       hub.handleUnknownSenders
  └── rotate-password       hub.handleRotatePassword

GET  /api/hub/
  ├── arrivals              hub.handleArrivals          ← the log, as a table
  ├── inbox                 hub.handleInbox             ← the ring
  ├── status                hub.handleStatus
  ├── who                   hub.handleWho
  ├── handle                hub.handleHandle
  ├── device                hub.handleDevice
  └── unknown-senders       hub.handleUnknownSenders

POST /api/fs/
  ├── save                  handleFsSave
  ├── delete                handleFsDelete
  └── annotate              handleFsAnnotate

GET  /api/fs/
  ├── stat                  (inline)           → fs.statFile
  └── annotations           (inline)           → fs.getAnnotations

POST /api/jobs
  ├── (none)                handleCreateJob
  ├── <id>                  handleJobUpdate
  └── <id>/cancel           handleCancelJob

GET  /api/jobs              (inline)           → jobs.listJobs
GET  /api/events            handleSseConnection         ← jobs AND arriving packets
POST /api/proxy             handleGenericProxy
GET  /api/version

POST /                      "POST accepted"
```

Eight `/api/hub/` POST, seven GET. Three `/api/fs/` POST, two GET.
Anything else under POST is `405`.

**Every hub route now names a handler.** `/api/hub/post` was the last one
written out inside the route table; the rules it enforces — is this node
attached to a relay, which relay to send through, what `via` overrides —
could only be exercised by making an HTTP request until it moved.

**`/api/fs/save-app-script` and `/api/fs/save-app-manifest` are gone**
(decision 0008). `saveFile` refuses an app's own entry script and
manifest, and there are no exceptions left to that refusal.

---

## The two interfaces the contract was about

Read across the method boundary rather than down one column:

| | post to a peer, with reply | find out what arrived |
|---|---|---|
| **an app** | `api.sendMessagePacket` — names no path | `api.onPacket` — names no path |
| **node** | `POST /api/hub/post` | `GET /api/events` (live) + `GET /api/hub/arrivals` (catch-up) |
| **relay** | `POST /api/relay/post` + `/reply` | `GET /api/relay/stream` |

Live and catch-up are two doors on one idea, and the split is real rather
than untidy: one is a connection being held open, the other is a question
about the past. `/api/events` carries **both** job events and arriving
packets, which is why it is named for the node rather than for jobs.

**`/api/hub/send` and `/api/hub/inbox` are the ring**, still wired, and
no app names `send` any more.

---

## Three structural notes

**`/api/relay/*` is not relay-only in code.** The relay object is built
unconditionally at [server.js:15](../../spirit/run/js/server.js#L15), and
the relay routes are dispatched in the same blocks as the hub routes. On
a personal node they are live — behind the loopback gate, like everything
else it serves. What separates the two servers is not which handlers
exist; it is which ones the door lets a request reach.

**Seven routes are still written out inline.** On the relay: `post`,
`reply`, `remove-peer` and `stream`. On the node: `fs/stat`,
`fs/annotations` and `GET /api/jobs`.

All seven are pass-through — read the input, call one function, write the
result — with no decisions in them, which is what makes them different
from `/api/hub/post` before it moved. **Every route that decides
something now names a handler.**

**`/api/hub/peer` never leaves the machine.** Block, unblock, accept and
label are `whoBook` writes. Taking somebody off a relay is
`/api/relay/remove-peer`, and **nothing under `run/` calls it** — the
verb exists, is signed, works, and has no door on the node side.
