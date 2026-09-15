# The node API — route hierarchy

**Measured at working tree, 2026-09-15** (after `25489ab`). Every route both
servers dispatch and the function it lands in. Illustration only: no argument,
no proposal, nothing about what should change.

One file, [`spirit/run/js/server.js`](../../spirit/run/js/server.js),
serves both. Which server you get is `--relay` on the command line.

---

## The relay — `node js/server.js --relay`

Binds `0.0.0.0`. Every path not on the allowlist
(`isRelayPublicPath`, [server.js:680](../../spirit/run/js/server.js#L680))
is 404 before dispatch, so this is the whole surface.

```
POST /api/relay/
  ├── claim                 handleRelayClaim   → relay.claim         ← bootstrap
  ├── post                  (inline)           → relay.routePost
  ├── reply                 (inline)           → relay.routeReply
  └── device                handleDeviceOffer  → relay.deviceOffer   ← bootstrap

GET  /api/relay/
  ├── who                   handleRelayWho     → relay.who           ← public census
  └── stream                (inline)           → relay.streamOpen    ← the held wire

GET  /api/version                                                    ← public
GET  /, /index.html, /relay.html, /favicon.svg                       ← the brochure
GET  /<key>/device                                                   ← the enrol page
```

**Four POST, two GET**, plus `/api/version` and static files. All of `relay.js`.

It was five POST and four GET on 2026-09-13. `send` and `inbox` went with the
ring (R8); `status` went with the owner badge that was its only caller (R3).
Nothing was added.

**What GET is for on a relay**: static files, and the two things that must work
before a post is possible — `who`, because it is where a node learns the relay's
key, and `stream`, because a post is answered on the connection it opens. You
cannot post to an address you are still asking for, and you cannot post to open
the channel that carries the answer.

**What POST is for**: two halves of the router, and two bootstraps. `claim` is
permanently outside the protocol — you cannot post to a relay you have no row
on. `device` is posted by a browser with no identity yet, which is the thing it
is asking for.

### Everything else a relay can be asked is a packet

`post` carries them. A relay answers a packet addressed to its own key in
`relay.answerSelf` ([relay.js:1358](../../spirit/run/js/relay.js#L1358)), and
the verbs are:

```
{ monitor:    { on, filter } }   owner        traffic events, live, never stored
{ invite:     { label, days, token } }        owner
{ revoke:     { label } }        owner
{ removePeer: { key } }          owner, or anybody about themselves
{ rename:     { label } }        own row      a peer renaming itself
```

Five, and `monitor` is the watching one — there is no separate `watch` verb,
though the comments around `statusToOwner` talk about watching.

**None of these has a route, and none needs one.** That is the whole of what
2026-09-15 changed on the node side: a verb the relay answers is reachable
because the browser can address the relay, so there is nowhere left for a door
to be missing from. `removePeer` sat in that gap for months and `revoke` shipped
with it the same morning.

### The relay's own key is a destination

A relay is a peer to every member. Its key is published in the census, it
appears in every member's roster (`relay.streamRoster`), and posts addressed to
it are answered like any other. That is what makes the verbs above reachable
without routes.

---

## The personal server — `node js/server.js`

Binds loopback only, with a Host check. Everything below is reachable from this
machine and nowhere else.

```
POST /api/hub/
  ├── post                  hub.handlePost      ← THE ONLY DOOR ONTO THE WIRE
  │
  ├── claim                 hub.handleClaim     ← bootstrap
  ├── contact               hub.handleContact
  ├── peer                  hub.handlePeer
  ├── unknown-senders       hub.handleUnknownSenders
  └── rotate-password       hub.handleRotatePassword

GET  /api/hub/
  ├── status                hub.handleStatus    ← the badge, by key
  ├── who                   hub.handleWho
  ├── handle                hub.handleHandle
  ├── device                hub.handleDevice
  └── unknown-senders       hub.handleUnknownSenders

POST /api/fs/
  ├── save                  handleFsSave
  ├── delete                handleFsDelete
  └── annotate              handleFsAnnotate

GET  /api/fs/
  ├── stat                  (inline)
  └── annotations           (inline)

POST /api/jobs                handleCreateJob
POST /api/jobs/<id>           handleJobUpdate
POST /api/jobs/<id>/cancel    handleCancelJob
GET  /api/jobs                (inline)

POST /api/proxy               handleGenericProxy
GET  /api/events              handleSseConnection   ← the node's own stream
GET  /api/version
```

### One door puts things on the wire

`/api/hub/post` is the only route on this node that reaches `router.post`, and
`spirit/test/serverSurface.js` asserts it by reading `hub.js`: a second caller
would be a second way onto the wire, whether or not a route had been wired to it
yet.

**Four doors stood beside it until 2026-09-15** — `invite`, `rename`, `revoke`
and `remove-peer` — each building one packet body and handing it to
`router.post`. `askRelay` was their shared half and went with them.

What remains on `/api/hub/` is what is NOT a post:

- **bootstrap** — `claim`, and `device` on the GET side
- **reads** — `status`, `who`, `handle`, which fetch the public census
- **local** — `contact`, `peer`, `unknown-senders`, `rotate-password`, which are
  whoBook and password work on this machine and never touch a relay

### What a client is

A browser holds no key and cannot sign. Neither does a spawned process. Both are
**loopback clients**: they ask this node to act, and this node signs. The shell
hands apps `api.peerPost(app, toKey, body)` and `api.onRegarding(hash, fn)`
([shell.js](../../spirit/run/js/client/shell.js)); a process does the same thing
with an HTTP client and gets the same answer for the same reason. Neither is a
peer, because a peer holds a key. See decision 0011.

---

## What is gone, and why it is worth saying

| gone | when | why |
|---|---|---|
| `POST /api/relay/send` · `GET /api/relay/inbox` | R8, 2026-09-13 | the ring. A relay stores nothing on anyone's behalf (0006) |
| `GET /api/relay/status` | R3, 2026-09-15 | the owner badge was its only caller, and the census already answered it |
| `POST /api/relay/set-device` | 2026-09-13 | a relay holds no device key for it to install |
| `POST /api/hub/send` · `GET /api/hub/inbox` | R8 | the node's half of the ring |
| `GET /api/hub/arrivals` | — | no caller: a closed page catches up on the live channel |
| `POST /api/hub/invite` · `rename` · `revoke` · `remove-peer` | 2026-09-15 | each built one packet body. That is a peerPost |

Six routes and four doors, and none of them was replaced by anything. Each was
either a second way of saying something the protocol already said, or a thing
the protocol had decided not to do.

---

## The two interfaces the contract was about

**The relay's, which is the protocol.** Four POST, two GET, and a register that
now covers what travels on the stream as well as which doors exist
(decision 0010). `protocolSurface.js` fails in both directions: a door or an
event in the tree and not in the register, or the reverse.

**The node's, which is not.** `/api/hub/*` is this node's own front, reachable
only from this machine, and a node may shape it however suits its clients. What
it may not do is invent a word to say over the wire — and after 2026-09-15 it
cannot, because only one of its doors speaks.

---

## Structural notes

**`/api/events` is the node's stream, not Jobs'.** Named for what it is: jobs
were its first customer, and it now carries `job-updated`, `job-deleted`,
`relay-event` and `packet`.

**A relay writes no traffic log.** `trafficLog.note` returns null in relay mode
([trafficLog.js:226](../../spirit/run/js/trafficLog.js#L226)). The owner's log
of membership events lives on the owner's own node, fed down the stream — so a
relay keeps no record of who talked to whom.

**The hash is computed at every hop and carried on none.** A post is
`{from, to, text, sig}` with no hash and no correlation id. It crosses the wire
once, on the reply, inside the responder's signature. See decision 0011.
