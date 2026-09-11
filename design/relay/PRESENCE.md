# Presence — the first cut of the stream, carrying nothing else

**Status: in design. Verified against `8dcc28b` (2026-09-11).**

One held connection between a personal node and each relay it holds a row
on, carrying **who is reachable right now** and nothing else.

This is the first stage of [EVENT-STREAM.md](EVENT-STREAM.md) and it
**supersedes that document's §2 ordering**, which put the wire and the
message together. See §7 below.

---

## 1. What we are trying to achieve

Andy, setting the boundary:

> **A leftmost column in the Contacts app table, red or green, for the
> online status of the listed peers. No other app touched yet.**

That is the whole acceptance test. When a dot in Contacts goes green
because a peer's node connected, and red when it drops, the arc is done.

Underneath it, three sentences in this order:

> A relay knows who it can reach. A node knows who its contacts can
> reach. An app asks the shell, never the relay.

Nothing about messages changes in this arc. The relay still stores and
still hands back a backlog; chat still polls. Those are the *next* thing,
and they are only possible after this one.

**One app.** Contacts draws the column; Relay Chat, Natter and the rest
are not touched. The shell-side API is still built properly — one
mediated subscription, not one per app (§4) — because a second consumer
must cost nothing when it arrives. But it gets exactly one consumer
here.

## 2. Why this first, rather than anything else

**Everything downstream is blocked on it.** [Decision
0006](../decisions/0006-fast-and-true-not-guaranteed.md) says a relay
delivers to a connected recipient or refuses. That sentence is
unimplementable today: there is no channel to deliver *on*, and no way to
know who is *connected*. Remove buffering without this and every send
refuses forever, because nobody is ever connected in a sense the relay
can observe.

**The connection's existence IS the presence.** No heartbeat protocol, no
last-seen timestamps, no inference from poll history. Build the socket and
presence is free; build presence any other way and it is a worse thing
that gets thrown away.

**It is the payload that makes the hard question easy.** EVENT-STREAM §2
warns that a connection authenticated once and held for hours becomes
*"the standing licence the minute window was designed to prevent."* That
is a serious objection when the wire carries mail. When it carries *who is
up*, the licence is nearly worthless — `/api/relay/who` already publishes
every label and key to anyone. So the machinery gets proved where being
wrong is cheap.

**It replaces a measurement with a number.** The open TLS question — does
`relayRequest` reuse connections across polls — becomes moot. One held
connection is one handshake.

## 3. What already exists, and it is most of it

The node→shell half is **running in production for jobs**:

| | where |
|---|---|
| SSE endpoint, `snapshot` then incremental events, 20s heartbeat | [server.js:364](../../spirit/run/js/server.js#L364) |
| teardown on `close` **and** `error` | same, with the comment that earned it |
| browser wrapper over `EventSource` | [kernel.js:806](../../spirit/run/js/kernel.js#L806) |
| long-lived node-side state as a **permanent job** | `jobs.js` — `fs-watcher`, `server-stats` |

So the shape is two hops of the same protocol, and only the left one is
new:

```
relay  --SSE-->  personal node  --SSE-->  shell  -->  apps
       (new)                   (exists)
```

`server-stats` is the precedent worth copying: `createJob('permanent',
'server-stats', spirit.core.server.stats)` hands the job a live reference
and mutates it in place.

## 4. Decided

- **Presence is the NODE's, not the human's and not a browser's.** A node
  is up nearly always, which is what makes §6 cheap.
- **One connection per node per relay.** Held by the node, never by an app.
- **SSE on both hops, and it is less than the name suggests.** An
  ordinary HTTP GET whose response never ends: the server writes
  `event:` and `data:` lines separated by blank lines, and a lone `:` is
  a comment used as a heartbeat so nothing in between decides an idle
  connection is dead. That is the whole protocol — no framing, no
  handshake, no library.

  Not WebSocket. WebSocket starts as HTTP and *upgrades* to a different
  framed protocol: both ends need a library and every proxy has to pass
  the upgrade. SSE is HTTP being slow, so anything that can stream a
  response already handles it, Caddy included. The price is one
  direction, and presence has nothing to send — **the connection is its
  whole statement.** There is no announce step, nothing to expire, and
  nothing that can fall out of sync.

- **The node hand-rolls its SSE client. It may not use `EventSource`.**
  The browser half already does (`kernel.js` wraps it for jobs) and stays
  as it is: loopback, unsigned. The node half cannot, for a reason that
  is a rule rather than a preference:

  **`EventSource` cannot set request headers**, and cycle 4 established
  that the proof rides in `X-Spirit-Sig` and never the query string,
  because a query string lands in every access log it passes —
  `inboxSignatureFrom` refuses a query `sig` even when the header is
  good. An `EventSource` client could not authenticate to this relay
  without undoing that.

  Node 24 does have an `EventSource` behind `--experimental-eventsource`
  (checked, v24.20.0: absent by default, present with the flag). Not
  used: it would mean the flag in labMaster's spawn, spirit-3's systemd
  unit and the dev start, an experimental API under a long-running node,
  and it still could not set the header.

  So: `fetch` with a streaming body, split on blank lines, about forty
  lines and no dependency. Three things `EventSource` would have given
  free, and what happens to them — **reconnect with backoff** becomes
  ours, which we wanted anyway (a relay that is down must not be
  hammered); **`Last-Event-ID` replay** is not needed, because a full
  snapshot on connect is simpler and stateless, so nothing can be
  missed; **heartbeat tolerance** is one line, ignore a comment.

- **Three marks, not two.** Green and red are Andy's; the third is the
  one the design forces.

  | | |
  |---|---|
  | 🟢 `ICON.GREEN_CIRCLE` | present — a relay said so |
  | 🔴 `ICON.RED_CIRCLE` | absent — a relay said so |
  | ⚪ `ICON.WHITE_CIRCLE` | not known — no relay has said anything |

  The distinction that keeps it honest: **red and green both require a
  relay to have told us something. White is the absence of a statement,
  not a statement of absence.** A contact this node shares no relay with
  is unseen, not offline, and so is every contact in the seconds before
  the first snapshot lands — red there would be the UI claiming
  knowledge it does not have.

  White rather than black, which was the first proposal: the shell's
  ground is `#1a1a2e` with `color: #eee`, so ⚫ would be nearly
  invisible — and the one state meaning *"I do not know"* is exactly the
  one that must not be mistaken for an empty cell.
- **Nothing is persisted.** Presence is true only while a socket is open;
  written down it is a record of something that has stopped being true.
- **Keyed by public key.** The relay knows keys. Names and faces come from
  whoBook, which never leaves the node — so the join happens at home and
  the address book still cannot leak.

- **The shell gets ONE MERGED SET and nothing else.** Andy's ruling, and
  it is a simplification of an earlier draft of this bullet that handed
  the shell per-relay detail as well.

  The node merges every relay connection into the single channel the
  shell already has — `/api/events`, carrying the `relay-presence` job —
  so **no new shell-facing channel exists at all.** That is the whole
  reason for the permanent-job shape.

  A key can be present on two relays at once, so the node keeps the
  per-relay states **internally**, because it needs them to decide:

  ```
  bert-key -> { "https://spirit.andyflinn.com": present,
                "http://127.0.0.1:65401":       absent  }   (node only)
  ```

  What crosses to the shell is the verdict alone — 🟢 any relay says
  present; 🔴 some relay says absent and none says present; ⚪ no relay
  mentions this key at all. **Apps filter that set for whatever they
  need.** An app asking *"can I reach Bert"* is asking the only question
  the shell answers, and *where from* is diagnosis rather than an app
  concern. If something ever genuinely needs it, adding it is a widening
  of a payload; guessing now would be state kept against a use nobody
  has.

  **This does not foreclose relay health in Natter** (Andy), and that is
  a different fact rather than a softening of this one. *"Is Bert
  present on spirit-3 but not on the lab relay"* is a per-peer
  per-relay breakdown, and it stays out. *"Is my connection to spirit-3
  up"* is **one boolean per relay** — the presence job's own state,
  which it already has because it owns the sockets, and which the Jobs
  app shows by virtue of the job existing. Natter drawing it is a later
  and much smaller thing, and it needs nothing from the peer table.

- **The node tags which relay a line came from. The relay does not name
  itself.** A relay behind Caddy does not reliably know its own public
  URL — it sees a `Host` header and whatever the proxy chose to pass,
  the same class of thing that leaves `X-Forwarded-For` an open item.
  The node knows exactly which socket a line arrived on, because it
  opened it. **The relay says who; the node says where from.**

- **The relay's snapshot is the ROSTER WITH STATES, not the list of the
  connected.** This is what makes ⚪ honest, and it is easy to get wrong
  in the direction that looks tidier. If a relay sent only who is
  connected, a silent key would be indistinguishable between *a member
  who is away* and *somebody this relay has never heard of* — and the
  first is 🔴 while the second is ⚪. So the snapshot names every member
  and says of each whether it is here. The relay already holds both
  halves: `/api/relay/who` is the roster, the open sockets are the
  subset.
- **Apps get it from the shell, mediated.** Browsers cap concurrent
  connections per origin at about six; five apps with their own
  `EventSource` starve the shell. One subscription, fanned out.
- **The existing colours stand, and the question is not this
  document's.** Red is a *button* in the device panel — an action — and
  one of three read-only status marks here. Two roles, two contexts, and
  Andy's call is to keep the current design rather than invent a palette
  to avoid an overlap that does not confuse anybody.

  It differs from the ★ precedent in the way that matters: ★ meant the
  same *kind* of thing in both places — a status mark — so two meanings
  collided. These do not.

  It recurs, though, and it recurs because the repo has no rule about it
  yet. That rule belongs to the icon cleanup, not here:
  [design/cleanup/2026-09-11-icon-convention.md](../cleanup/2026-09-11-icon-convention.md),
  item 5.

- **The authentication re-signs on reconnect, and that is enough for
  now.** No re-signing on a timer while a connection is held. The
  standing licence EVENT-STREAM §2 warns about is worth little while the
  wire carries only who is up (§2), and the question genuinely bites
  when it starts carrying content — which is the point to revisit, not
  this one.

- **A stream subscription signs its own bytes.** `stream\n<key>\n<unix-minute>`,
  header-borne, checked +/-1 minute — the same shape as `inbox` and
  `device-take`, and for the reason `deviceGate` already records: the
  owner signs `status` constantly, and a captured signature must not be
  replayable as something else. A stream is a far better prize than a
  single read, because what it grants **stands** rather than happening
  once. So it gets its own verb, like every other.

- **A new authenticated connection tosses the old one for that
  identity.** Andy's rule, and his reason is the general one: *the relay
  does not worry about the node's problems.* A node that reconnects
  after a half-dead socket must not be locked out by its own corpse, so
  newest wins and the relay keeps no opinion about why.

  **Authenticate first, then toss.** The order is the whole safety of
  it: if an unauthenticated connect could displace a live one, anybody
  could knock any peer offline by connecting badly in their name. Only
  the holder of the key can evict the holder of the key.

- **Connects are rate limited per identity: six in a rolling minute,
  refused with 429.** A healthy node spends one and holds it for days; a
  flapping network spends a handful; a backoff bug spends them in a
  second, and that is the case this exists for — an exponential backoff
  is meant to prevent a connect storm and is also the thing that
  produces one when it is wrong.

  Six rather than `deviceHandshake`'s ten because the traffic is a
  different kind: device offers are a person pressing a button, and
  connects are a machine in a loop. The refusal has to be one a node
  backs *off* from rather than retries, which is why it is a status and
  not a silence.

- **Liveness is new disclosure, and it is intended.** `/who` says who
  exists; this says who is up, to everyone else on the relay. That lets a
  peer infer another's hours. Accepted deliberately on a relay whose
  members know each other.

## 5. Stages

Each ends green with its own tests, and is worth having on its own.

> **All four are built as of 2026-09-11, and the arc is closed** — except
> Stage 3, which was deliberately skipped rather than done. Stage 4 reads
> the `relay-presence` job off the shell's existing jobs channel, so the
> fold Stage 3 proposes would today have exactly one subscriber to fold.
> Do it when a second app wants presence, not before.
>
> The column is `contactsPresenceMark` in
> [`app/contacts/contacts.js`](../../spirit/run/app/contacts/contacts.js),
> covered by `spirit/test/contacts.js`, and demonstrated on a real screen
> by [`spirit/test/presenceShow.js`](../../spirit/test/presenceShow.js) —
> which moves the world one step at a time and asks a person what colour
> they see, because nothing between the job payload and the pixel has an
> automated witness.

### Stage 1 — the relay speaks presence

`GET /api/relay/stream`, authenticated once the way an inbox read is —
signed, header-borne, ±1 minute. The set of open connections is the
truth; a socket dying is an absence, with no separate timeout to tune.

Sends the **roster with each member's state** on connect — including the
members who are absent, without which the node cannot tell 🔴 from ⚪
(§4) — and changes thereafter.

*Done when:* two fake nodes connect to a lab relay, each sees the other;
killing one is visible to the other within a second; a stream with a bad
signature is refused before any state is allocated.

**Do not measure connection scale here** — see §8. The one thing worth
finding out now is narrower and immediate: whether a heartbeat is needed
through Caddy the way the 20-second one is needed inside, because without
it a quiet connection dies and every peer behind it reads as absent.

### Stage 2 — the node holds the socket

A third permanent job, `relay-presence`, next to `fs-watcher` and
`server-stats`. One connection per **claimed** relay (`claimedUrls`,
which B4 already computes). Reconnect with backoff. Teardown bound to
`close` *and* `error` — the lesson is already in the tree and it is the
one that makes a relay lie.

Merges every connection into one table keyed by public key, **tagging
each line with the relay it arrived on** — the node knows that, the relay
does not (§4). The per-relay states stay here, inside the job, because
deciding needs them. **Only the 🟢/🔴/⚪ verdict is emitted** (§4).

**Emits only when the set actually changes.** `fs-watcher` learned this:
*"a rescan that says the same thing is not news."* Presence has the same
hazard from the other end — every app subscribed to jobs sees every
`job-updated`, so a quiet relay must not repaint the Jobs screen forever.

*Done when:* the job appears in the Jobs app as a live row, a killed relay
shows as a reconnecting one, and an identical snapshot emits nothing.

### Stage 3 — the shell serves it

An in-memory table in the shell, built from the job payload, and
`spirit.core.presence.subscribe()` beside `spirit.core.jobs.subscribe()`.
One subscription regardless of how many apps ask.

The table is keys and their state, and nothing else — the join to whoBook
is Stage 4's, and belongs to the one app doing the drawing.

*Done when:* subscribing twice yields one `EventSource` and both callers
are fed; a shell reload rebuilds the table from a fresh snapshot with
nothing read from disk. Asserted with two subscriptions in a test rather
than two apps, since only one app consumes this arc.

### Stage 4 — the dot, and that is the boundary

A leftmost column in the Contacts table. Green for present, red for
absent, and a third mark for **not known** (§8) — because a contact this
node shares no relay with is not offline, it is unseen, and saying "red"
there would be the UI claiming knowledge it does not have.

The join happens here and only here: presence arrives keyed by public
key, whoBook says who that is. Contacts already lists peers and already
reads whoBook, so the column is a cell and a lookup.

*Done when:* a fake peer's node connects to a lab relay and the dot in
Contacts goes green without a reload; killing that node turns it red; a
contact on no shared relay shows neither.

**The arc ends here.** No other app, and nothing on the relay's send
path.

## 6. Out of scope, deliberately

- **Every app except Contacts.** Relay Chat's To list, Natter's rows and
  anything else that could show a dot are left alone. One consumer proves
  the shell API; a second one is a later line, not a later argument.
- **`send` refusing an absent recipient.** This was Stage 4 in the first
  draft of this document and is now the *next* arc, at Andy's boundary.
  Worth recording why it is the natural next step and what it costs:
  it is the down payment on 0006 — a **truthful refusal** — and it does
  not require removing the relay's buffer. It is also where a capability
  is actually lost, because today you can leave a message for someone who
  is away and afterwards you cannot. That is survivable only because of
  §4's first line — the recipient is a **node**, and a node is up nearly
  always. If presence meant *a browser is open*, that step would break
  messaging outright. The two decisions hold each other up.
- **Messages on the wire.** ~~Out of scope.~~ **Opened 2026-09-11 by
  [ROUTER.md](ROUTER.md)**, which is the cycle this fence existed to stop
  happening by accident. `request` and `reply` now travel on this
  connection, deliberately, and `presenceStream.js`'s fence check was
  narrowed in the same commit to what it was really guarding: presence
  operations emit presence events and nothing else.

  What has NOT changed: the relay still stores the last 200 messages for
  the old `send` path, and chat still polls it. The router carries
  nothing to disk, so the two coexist until the stored path is retired.
- **Device offers on the wire.** The 60s poll stays exactly as it is.
- **Removing the message buffer.** Blocked on the next item, not on this.
- **The handheld mail client** — and with it the multi-device race, where
  a phone and a desktop both poll one inbox and a draining relay would
  make them race. That is resolved by the node becoming the recipient and
  handhelds reading from their own node, which is a separate arc.
- Fan-out across relays; IndexedDB durability; the panel's copy control.

## 7. What this supersedes

[EVENT-STREAM.md](EVENT-STREAM.md) §2 says *"the stream carries the
message"* and reads as though 0006 already holds. **Neither is true yet**
— the relay stores the last 200 messages on disk
([relay.js:546](../../spirit/run/js/relay.js#L546)) and `inbox` filters
rather than drains ([relay.js:612](../../spirit/run/js/relay.js#L612)), so
a reader gets the whole backlog every poll, forever.

This document does not change that design. It splits it: **the wire first,
carrying the cheapest possible payload**, and the message later. A later
reader should take EVENT-STREAM as the destination and this as the route.

One consequence worth carrying to whoever does the message stage: the
device work widened the backlog's blast radius. A borrowed handheld does
not read new mail, it reads the **last 200 messages**, including
everything sent before that device existed.

## 8. Open

- **What a relay does at connection scale.** Deferred deliberately, and
  Andy's reason is the good one: *"we can't measure/predict until the
  relay is gutted."* A relay that still stores two hundred messages,
  still answers a polled inbox and does not yet hold a connection per
  member is not the relay whose limits matter. Numbers taken now would
  describe a machine that is about to stop existing.

  It is still the number that eventually decides whether presence can be
  offered to people who are not members — so it is a question with an
  owner and a time, not a forgotten one.
