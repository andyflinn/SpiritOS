# The node API — route hierarchy

**Measured at working tree, 2026-09-13** (after `1502e2a`). Every route both servers dispatch
and the function it lands in. Illustration only: no argument, no
proposal, nothing about what should change.

One file, [`spirit/run/js/server.js`](../../spirit/run/js/server.js),
serves both. Which server you get is `--relay` on the command line.

---

## The relay — `node js/server.js --relay`

Binds `0.0.0.0`. Every path not on the allowlist
(`isRelayPublicPath`, [server.js:673](../../spirit/run/js/server.js#L673))
is 404 before dispatch, so this is the whole surface.

```
POST /api/relay/
  ├── claim                 handleRelayClaim   → relay.claim
  │
  ├── post                  (inline)           → relay.routePost
  ├── reply                 (inline)           → relay.routeReply
  ├── send                  handleRelaySend    → relay.send          ← the ring
  │
  └── device                handleDeviceOffer  → relay.deviceOffer

GET  /api/relay/
  ├── who                   handleRelayWho     → relay.who           ← public census
  ├── status                handleRelayStatus  → relay.status        ← owner-signed
  ├── inbox                 handleRelayInbox   → relay.inbox         ← the ring
  └── stream                (inline)           → relay.streamOpen    ← the held wire

GET  /api/version                                                    ← public
```

**Five POST, four GET**, plus `/api/version`. All of `relay.js`.

It was seven POST this morning. `invite` and `monitor` became posts;
`remove-peer` became a post; `set-device` was deleted outright, because a
relay holds no device key for it to install. Decision 0010's register of
named cheats is empty.

Two of the five that remain — `send`, and `inbox` on the GET side — are
**the ring**, and are sentenced rather than justified. See the contract
section below for why they are one lump.

**What GET is for on a relay** (granted by Andy, 2026-09-13): static
files, and the three things that must work before a post is possible —
`who`, because it is where a node learns the relay's key; `stream`,
because it is the wire a post's answer comes back on; and `version`,
because a deploy check must not need a private key. Each sits *before or
beneath* the protocol, and a protocol cannot express its own
preconditions.

Everything else must be a post, and as of 2026-09-13 everything else is
one. Two GETs are outstanding: `inbox` dies with the ring, and `status`
owes an argument — it is un-postable because of the ORDER this node does
its work in, not because of anything about the relay.

### The relay's own key is a destination

**`relay` is no longer an addressable destination BY NAME.** It is still a
reserved name nobody may claim and no invite may be labelled with — a
namespace rule that outlived the console it used to serve.

**Its KEY is addressable, by its owner and by nobody else.** A post to the
relay's own public key is answered by `relay.answerSelf`, and that is
where four owner verbs live — two that used to have doors of their own,
and two that never had a door at all:

```
POST /api/relay/post  → relay.routePost
                          ├── postedToSelf?  → relay.answerSelf
                          │                     │
                          │                     │  OWNER VERBS — the house key
                          │                     ├── body.monitor    → start/stop watching
                          │                     ├── body.invite     → relay.mint
                          │                     ├── body.revoke     → invites.revokeInvite
                          │                     ├── body.removePeer → relay.forgetPeer   (anybody)
                          │                     │
                          │                     │  OWN-ROW VERBS — any identity with a row
                          │                     └── body.removePeer → relay.forgetPeer   (yourself)
                          └── otherwise      → the peer it names
```

**Any peer on the relay may address it.** That opened on 2026-09-13, and
it is what let `set-device` and self-removal stop being cheats. It also
corrects this page: an earlier version said a peer got `no such peer` and
learned nothing, on the grounds that the key was hidden. It is not — the
relay publishes it unsigned in `/api/relay/who`, because a node needs it
to pin the box and to post THROUGH it.

What refuses a peer now is **the verb, not the door**. `answerSelf` gates
one verb at a time, and an owner verb asked by a peer answers `no such
peer` — exactly what a verb nobody has heard of gets, so the set of things
this box will do for somebody else cannot be enumerated by asking it.

The proof for both kinds is the same signature: the post's, checked once
in `routePost`. Only *which row it has to be* differs.

Two are worth naming for what they show about the rule:

**`body.revoke` is the first verb designed after 0010** rather than
collapsed into it. It takes an invitation back by label and has no self
path — an unclaimed invitee has no identity here and can sign nothing —
so it was born as a packet and never needed a door. Before it, an
unclaimed invite could not be revoked at all: `revokeLabel` existed, only
`removePeer` called it, and `removePeer` needs a row.

**`body.removePeer` is one verb of both kinds**, which is why it reads
twice in the tree above. The owner may name anybody; anybody else may name
only themselves. That was `byOwner || bySelf` on a public route, and it is
the same rule decided by who signed rather than by a second signature.

**`body.setDevice` was here for a few hours, and is gone.** It was the
verb that proved a relay should answer more than its owner — installing a
key on your own row was never an owner verb. Then the same reasoning went
one step further:

> Andy: *"the device key is used to mirror/fake the protocol for the one
> leg of the route where it's not actually compliant... and to safely tie
> a device to its node."*

**Both jobs are the node's, so a relay now keeps no device key at all.**
It was read in exactly two places — inside `send` and inside `inbox` — and
nothing in the tree ever exercised either; `device.html`'s own
`sendMessage` helper had one occurrence, its own definition.

The door it opened stays open: removing yourself is still an own-row verb,
and that is what keeps the per-verb gate honest rather than decorative.

---

## The personal server — `node js/server.js`

Binds `127.0.0.1`, and refuses anything that is not loopback with a valid
`Host` before dispatch ([server.js:727](../../spirit/run/js/server.js#L727)).
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
  ├── stat                  (inline)           → spirit.core.fs.statFile
  └── annotations           (inline)           → spirit.core.fs.getAnnotations

POST   /api/jobs                       handleCreateJob
POST   /api/jobs/<id>                  handleJobUpdate
POST   /api/jobs/<id>/cancel           handleCancelJob
DELETE /api/jobs/<id>                  handleDeleteJob
GET    /api/jobs                       (inline)  → jobs.listJobs

GET  /api/events            handleSseConnection         ← jobs AND arriving packets
POST /api/proxy             handleGenericProxy
GET  /api/version           (inline)

POST /                      "POST accepted"
```

**Eight `/api/hub/` POST, six GET.** Three `/api/fs/` POST, two GET.
Anything else under POST is `405`; `DELETE` serves one route and nothing
else.

**Every hub route names a handler.** `/api/hub/post` was the last one
written out inside the route table; the rules it enforces — is this node
attached to a relay, which relay to send through, what `via` overrides —
could only be exercised by making an HTTP request until it moved.

**`/api/hub/invite` and `/api/hub/remove-peer` are doors, not protocol.**
Both take a url, both post to that relay rather than calling a route on
it, and both need `router` and `relayKey` handed in the way
`/api/hub/post` needs `router` and `presence`. They share `hub.askRelay`,
which is the one place that tells a post that never arrived apart from one
that arrived and was refused.

This is the line decision 0010 draws: **a node may shape its own door
however suits the browser; what it may not do is invent a word to say over
the WAN.** Neither of these does — both send an ordinary post.

---

## What is gone, and why it is worth saying

**Four relay routes** — `invite`, `monitor`, `remove-peer` and
`set-device`. With them went `mintMessage`, `monitorMessage`,
`removePeerMessage`, `setDeviceMessage`, `relay.setMonitor`,
`handleSetDevice`, `hub.handleMonitor` and `POST /api/hub/monitor`.
**Nothing replaced any of it**, and the register of named cheats is empty.

Three became posts. **`set-device` did not** — it was deleted, along with
`relay.installDevice`, `deviceAuth.keysForName`, `deviceTick`'s
`installEverywhere` and the relay's `deviceByName`. A device is bound to
its NODE; the relay's copy of the key was read only by `send` and `inbox`,
by nothing.

**`POST /api/hub/send`** — the node's door onto the ring, and it had no
caller anywhere. `hubPost.js` had been asserting exactly that: *"nothing
above the boundary names /api/hub/send."* Relay Chat sends through
`/api/hub/post`, the router. `hub.handleSend` and `signedSend` went with
it. What is left of the ring is on the relay, and goes as one lump — see
the contract section.

**`GET /api/hub/arrivals`** — the log as a table, and it had **no caller
anywhere in the tree**. Catch-up was already solved one layer down and
better: `createArrivals.subscribe` hands a page the un-taken backlog on
the same live channel a new packet arrives on, so a page that was closed
gets what it missed without asking a second door a weaker version of the
question. `hub.rowAsMessage` went with it.

**`/api/fs/save-app-script` and `/api/fs/save-app-manifest`** — decision
0008. `saveFile` refuses an app's own entry script and manifest, and there
are no exceptions left to that refusal.

**Two faults, opposite shapes, and neither visible to
`spirit/test/protocolSurface.js`** — it can only compare two lists of
things that exist. `relay.removePeer` was a verb nothing could reach;
`/api/hub/arrivals` was a door nothing called. Both are impurities; only
the first looked like a missing feature.

---

## The two interfaces the contract was about

Read across the method boundary rather than down one column:

| | post to a peer, with reply | find out what arrived |
|---|---|---|
| **an app** | `api.sendMessagePacket` — names no path | `api.onPacket` — names no path |
| **node** | `POST /api/hub/post` | `GET /api/events` |
| **relay** | `POST /api/relay/post` + `/reply` | `GET /api/relay/stream` |

**There is one door on the right-hand column now, and that is the point.**
It used to be two — live on `/api/events`, catch-up on
`/api/hub/arrivals` — split on the reasoning that a held connection and a
question about the past are different things. They are, but the split was
in the wrong place: the node already knows which rows a page has been
handed (`taken`), so the backlog belongs at the front of the live stream
rather than behind a second door the client has to know to knock on.

`/api/events` carries **both** job events and arriving packets, which is
why it is named for the node rather than for jobs.

**`GET /api/hub/inbox` is what is left of the ring on this node**, and it
is a read: Relay Chat polls it every two seconds for its receive path, and
Natter uses it once as a cheap *"is this label still mine"* probe. The
write door is gone.

**The ring never kept the promise it was made for**, which is the argument
that sentences it rather than the router being nicer:

> Andy: *"the ring was a lie all along. it was unable to promise reliable
> delivery anyways, because it dropped entries on overflow."*

The cap is **200 global** — one array for every peer on the relay,
filtered per reader at read time — so a peer sending 200 messages to
themselves evicts everybody else's undelivered mail, and nothing is told.

What remains goes together, because splitting it leaves a signed format
guarding an unreachable function: `relay.send`, `POST /api/relay/send`,
`sendMessage`, `checkSend`, the `messages` array and `inbox`. Note that
`/api/relay/send` is **not** wire-dead the way the hub door was —
`labPopulate`, `liveFrontDoor` and five `labMaster` suites use it to make
ring traffic, and nine suites call `box.send` directly.

---

## Structural notes

**`/api/relay/*` is not relay-only in code.** The relay object is built
unconditionally at [server.js:15](../../spirit/run/js/server.js#L15), and
the relay routes are dispatched in the same blocks as the hub routes. On a
personal node they are live — behind the loopback gate, like everything
else it serves. What separates the two servers is not which handlers
exist; it is which ones the door lets a request reach.

**Eight routes are still written out inline.** On the relay: `post`,
`reply`, `remove-peer` and `stream`. On the node: `fs/stat`,
`fs/annotations`, `GET /api/jobs` and `GET /api/version`.

All eight are pass-through — read the input, call one function, write the
result — with no decisions in them, which is what makes them different
from `/api/hub/post` before it moved. **Every route that decides something
names a handler.**

**`/api/hub/peer` never leaves the machine.** Block, unblock, accept and
label are `whoBook` writes. Taking somebody off a relay is
`/api/hub/remove-peer`, which posts — and which did not exist until
2026-09-13, so until then the verb worked and no door on this side could
reach it.

**No route on this relay is a named cheat any more**, which is a claim
this page can make because there is a register that says so and a test
that keeps it honest (`spirit/test/protocolSurface.js`).

One thing is still owed an argument: `GET /api/relay/status`.
`presenceNode.start` reads it to learn which relays to open streams to, so
a posted `status` would need a stream its own answer is what decides to
open. That is circular **as ordered, not by nature** — and under the
standing rule, the ordering is what has to be defended.
