# The node API — route hierarchy

**Measured at working tree, 2026-09-15** (after `4bf13c5`). Every route both
servers dispatch and the function it lands in. Illustration only: no argument,
no proposal, nothing about what should change.

Remeasured after stages 1–4b of the loopback fold. The relay section below is
unchanged from `25489ab`; the node section is not, and says where it stands.

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
POST /api/spirit              ← ONE DOOR. The verb is in the body.

  WIRE — these reach a relay, and being offline fails them

    net.fetch                   handleGenericProxy
    relay.claim                 hub.handleClaim
    relay.status                hub.handleStatus      ← the badge, by key
    peer.post                   hub.handlePost        ← THE ONLY WAY ONTO THE WIRE
    peer.list                   hub.handleWho
    peer.find                   hub.handleHandle
    peer.acquire                hub.handleContact

  LOCAL — these are this machine, and cannot be unreachable

    jobs.list   .create .update .cancel .delete
    fs.stat     .annotations .save .delete .annotate
    device.info .rotate         hub.handleDevice / handleRotatePassword
    contact.block .unblock .accept .label      hub.handlePeer
    contact.senders .setSenders hub.handleSendersRead / handleUnknownSenders

GET  /api/events              handleSseConnection   ← the node's own stream
GET  /api/version
```

### The verb is the address

Measured at `c214dd4` plus the working tree. Twelve routes became one door and
twenty-two verbs across four stages on 2026-09-15 — `net`, `jobs`, `fs`,
`device`, `relay`, `contact`, `peer`. **There is no `/api/hub/*` any more**;
server.js carries the map from each old path to its verb, in one place, beside
the dispatch.

Two verbs are worth knowing were once one thing:

- **`contact.*` was `POST /api/hub/peer` with `{ action }`** — a verb inside a
  body, under a route that was also a verb, dispatched by hand in hub.js beside
  a dispatch the door already does.
- **`contact.senders` / `contact.setSenders` was one handler branching on
  `req.method`** — which under one door is `POST` for both, so the branch had
  become a coin-toss where a forgotten method reads instead of writes.

### Why `peer.list` is not `contact.list`

A person doing either is doing contact work, and grouping by that would have put
a 502 and a file write in one namespace. `peer.*` asks a RELAY who is out there;
`contact.*` edits the book on this disk. `peer.acquire` is the seam: it asks the
relay whether the key is really there, and only then writes a row — wire,
because the asking can fail, and the write never happens when it does.

Two things stay routes for reasons that are not taste. `GET /api/events` is a
long-lived server-push connection, a different transport shape rather than a
different verb, and no body can express it. `GET /api/version` has to answer a
client that knows nothing — including one running older code, which is the case
it exists for.

**A module CLAIMS a namespace** ([verbTable.js](../../spirit/run/js/verbTable.js)),
at the foot of server.js where its dependencies exist, so the dispatch knows how
to find an answer and nothing about what the answers are. Two modules claiming
the same namespace, or one answering outside its own, is a crash at boot rather
than a surprise months later.

**Every namespace declares `wire: true|false`.**

> Andy: "wire or not is the most important distingtion, wire requires that the
> local box be online, others who knows."

That is the client's failure contract rather than a maintainer's note: a wire
verb can answer "not reachable right now" and yields a hash, a local one can do
neither, and a caller handles those differently. `table.needsWire(verb)` answers
it — `null` for an unclaimed verb, because "no such verb" and "works offline"
must not look alike.

`relay.status` is the one worth knowing about: it reads like local
configuration and is not. `ownerBadge.probe` fetches `/api/relay/who` from every
configured relay, so an offline box answers 502, and a caller who assumed
otherwise would draw an empty relay list and call it the truth.

### One door puts things on the wire

`peer.post` is the only verb on this node that reaches `router.post`, and
`spirit/test/serverSurface.js` asserts it by reading `hub.js`: a second caller
would be a second way onto the wire, whether or not a verb had been claimed for
it yet.

**Four doors stood beside it until 2026-09-15** — `invite`, `rename`, `revoke`
and `remove-peer` — each building one packet body and handing it to
`router.post`. `askRelay` was their shared half and went with them.

Nothing remains on `/api/hub/`. What was not a post folded onto `/api/spirit`
the same day — the table at the top of this section is the whole node API, and
server.js carries the old-path-to-verb map beside the dispatch for anyone
reading an older app.

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
