# The node API — route hierarchy

Measured at working tree, 2026-09-13. Every route both servers dispatch
and the function it lands in. Illustration only: no argument, no
proposal, nothing about what should change.

One file, [`spirit/run/js/server.js`](../../spirit/run/js/server.js),
serves both. Which server you get is `--relay` on the command line.

**Changed since the second version of this page** (at `e52a8ac`): the
relay lost two doors and the node lost one, all three to decision 0010's
collapse — `POST /api/relay/invite`, `POST /api/relay/monitor`, and
`POST /api/hub/monitor`. Nothing replaced them. Both relay verbs are said
as posts now, because a relay is an addressable peer for its owner, and
`/api/hub/invite` stayed exactly where it was with a post underneath it.

**Changed since the first version** (which was POST only, at `7734ecc`):
`/api/hub/post` has a handler instead of being written out in the route
table; `/api/hub/arrivals` is new; both `/api/fs/save-app-*` routes are
gone. The GET side is included now, because the two halves of one idea —
post to a peer, find out what arrived — sit on opposite sides of the
method.

---

## The relay — `node js/server.js --relay`

Binds `0.0.0.0`. Every path not on the allowlist
(`isRelayPublicPath`, [server.js:693](../../spirit/run/js/server.js#L693))
is 404 before dispatch, so this is the whole surface.

```
POST /api/relay/
  ├── claim                 handleRelayClaim   → relay.claim
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

Seven POST, four GET, plus `/api/version`. All of `relay.js`.

**`relay` is no longer an addressable destination BY NAME.** It is still a
reserved name nobody may claim and no invite may be labelled with — a
namespace rule that outlived the console it used to serve.

**Its KEY is addressable, by its owner and by nobody else.** A post to
the relay's own public key is answered by `relay.answerSelf`, which is
where two verbs went that used to have doors of their own:

```
POST /api/relay/post  → relay.routePost
                          ├── postedToSelf?  → relay.answerSelf
                          │                     ├── body.monitor  → start/stop watching
                          │                     ├── body.invite   → relay.mint
                          │                     ├── body.revoke   → invites.revokeInvite
                          │                     └── body.removePeer → relay.forgetPeer
                          └── otherwise      → the peer it names
```

Every other sender posting to that key gets `404 no such peer` — the same
answer an unknown key gets, so nothing about this is discoverable from
outside. See decision 0010.

`body.revoke` is worth noting as the first verb **designed** after 0010
rather than collapsed into it: it takes an invitation back by label, it
has no self path (an unclaimed invitee has no identity here and can sign
nothing), and so it was born as a packet and never needed a door. Before
it, an unclaimed invite could not be revoked at all — `invites.revokeLabel`
existed but only `removePeer` called it, and removePeer needs a row.

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
  ├── invite                hub.handleInvite            ← posts to the relay
  ├── remove-peer           hub.handleRemovePeer        ← posts to the relay
  │
  ├── post                  hub.handlePost              ← the router
  ├── send                  hub.handleSend              ← the ring
  │
  ├── contact               hub.handleContact
  ├── unknown-senders       hub.handleUnknownSenders
  └── rotate-password       hub.handleRotatePassword

GET  /api/hub/
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

Nine `/api/hub/` POST, six GET. Three `/api/fs/` POST, two GET.
Anything else under POST is `405`.

**`GET /api/hub/arrivals` is gone** — the log as a table, with no caller
anywhere in the tree. Catch-up was already solved one layer down:
`createArrivals.subscribe` hands a page the un-taken backlog on the same
live channel a new packet arrives on, so a page that was closed gets what
it missed without asking a second door a weaker version of the question.

**`POST /api/hub/remove-peer` is new**, and closes the opposite fault:
`relay.removePeer` had worked since it shipped and nothing under `run/`
could reach it. A verb with no interface is as much an impurity as an
interface with no caller, and neither is visible to
`protocolSurface.js` — it can only compare two lists of things that
exist.

**Every hub route now names a handler.** `/api/hub/post` was the last one
written out inside the route table; the rules it enforces — is this node
attached to a relay, which relay to send through, what `via` overrides —
could only be exercised by making an HTTP request until it moved.

**`/api/hub/invite` is unchanged as a door and different underneath.** It
still takes a url and a label and still answers 201 with the invite. What
it does with them is post to that relay rather than call a route on it,
so it needs `router` and `relayKey` handed in the way `/api/hub/post`
needs `router` and `presence`. This is the line decision 0010 draws: a
node may shape its own door however suits the browser; what it may not do
is invent a word to say over the WAN.

**`POST /api/hub/monitor` is gone**, and nothing took its place. The panel
that wanted it posts to the relay through `/api/hub/post` like any app
posting to any peer.

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

**Two of the relay's POST routes are named cheats, plus the GET
`status`**, which is a claim
this page can make because there is a register that says so and a test
that keeps it honest: `remove-peer` — which now carries only the departing peer's own exit,
the owner's half having become a post — and `set-device`.
Each is a way of speaking on the wire that the protocol cannot carry as a
post, and each is listed in decision 0010 with the reason. `invite` and
`monitor` were on that list until they came off it by being deleted.
