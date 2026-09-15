# 0010 — If the protocol cannot carry it, stop

**Decided 2026-09-13 by Andy. Measured against `a241dbc`.**

> If the protocol doesn't support it: no code until a decision is reached:
> fix the protocol, or cheat?

## The decision

When something has to cross the WAN and the protocol cannot express it,
**no code is written until that is decided out loud.** Three outcomes,
and all three are allowed:

1. **Fix the protocol** so it can carry the thing.
2. **Cheat, and name it** — write it down as a cheat, with what it costs
   and what would undo it.
3. **Don't do the thing.**

What is not allowed is the fourth outcome, which is what happens by
default: a new signed message format and a new route appear, the feature
works, and nobody ever calls it a decision.

## And the standing half, which this decision was missing

Everything above is REACTIVE — it fires when something new is being
added. Written that way, it let a named cheat sit indefinitely: the
register said what each one cost, nobody was extending anything, and the
rule was satisfied.

That is not the rule.

> **Andy: "first priority will always be: keeping the protocol clean,
> anything that can be done by protocol MUST be done by protocol."**

So there is a second, standing obligation, and it runs the other way:

**A cheat that has BECOME expressible as a packet must be collapsed.**
Not "may be", and not "is listed as open". The burden is on the cheat.

Two consequences worth stating, because they are the ones that were
quietly being avoided:

- **"Cheat by arrangement" does not survive this.** If a thing is only
  un-postable because of the ORDER in which this node does its work, the
  order is what has to be argued for — not the cheat. `GET
  /api/relay/status` is exactly that case; see the register.
- **A narrowing that blocks a collapse is itself a thing to re-examine.**
  `set-device` and the self half of `remove-peer` were stuck for one
  reason: a relay answered its owner and nobody else. That was the right
  call when it was made and it was not a fact of nature. Opening it
  deleted both — and `set-device` twice over, since the reasoning that
  opened the door then showed the relay had no business holding a device
  key at all.

### The exceptions, granted

**Granted by Andy, 2026-09-13.** Asked whether GET on a relay would be
for static files only, the answer is: static files, **plus three things
that must work before a post is possible.**

| granted | why it can never be a post |
|---|---|
| the brochure — `/`, `/index.html`, `/relay.html`, `/favicon.svg`, and the key-addressed enrolment page | files |
| `GET /api/relay/who` | it is where a node learns the relay's KEY. You cannot post to an address you are still asking for |
| `GET /api/relay/stream` | it is the wire itself. Posts are answered on this connection, so you cannot post to open the channel that carries the answer |
| `GET /api/version` | deliberately credential-free: *"the question a deploy check asks must not need a private key, or the check cannot run from anywhere but the owner's own machine."* A post needs a row; needing nothing is the point |

They share a shape, and it is worth naming because it is what makes them
principled rather than convenient: **each one sits before or beneath the
protocol.** `who` is before you have an address, `stream` is the channel
the protocol runs on, `version` is before you have any relationship at
all. A protocol cannot express its own preconditions. That is not a gap
in this rule — it is where the rule bottoms out.

So, stated whole:

> **GET on a relay is for static files, and for the three things that
> must work before a post is possible. Everything else must be a post.**

Everything not on that list has to earn its exemption. Two were
outstanding when this was written; **one has since gone.** `GET
/api/relay/inbox` died with the ring on 2026-09-15 (R8), leaving `GET
/api/relay/status`, which owes an argument — see the register.

## The narrowing, because a rule that fires on everything is ignored

**It applies to one thing: a new way of speaking on the wire.** In this
tree that has exactly two shapes, and both are greppable:

- a new `<verb>Message()` in `relayAuth.js`, `invites.js` or
  `deviceAuth.js` — a new format of signed bytes
- a new `/api/relay/*` route — a new public door

**It does not apply** to node-local work (`whoBook`, preferences, the
traffic log), to anything in the browser (panels, layout, copy), or to
anything already expressible as a post. Most work is untouched by this.

If you are adding either of those two things, you are extending the
protocol by hand. Stop and decide.

## Why, in one worked example that is mine

`/api/relay/monitor` and `monitorMessage` were added on 2026-09-13,
because the relay needed to be told to start streaming its activity and
the protocol had no way to say it. It worked. It was tested. It was also
a cheat, and nobody called it one.

Hours later the same day Andy said the panel should go through protocol,
the relay became addressable by its owner (R18), and **the same verb
became expressible as a packet** — post to the relay, get a signed reply
correlated by hash. The route and the message format were redundant, and
they were only redundant because the protocol was fixed afterwards.

Had this decision existed that morning, the order would have been:
notice the protocol cannot say it → decide → fix it → then write the
feature once.

**That is the whole cost of not having this rule: the feature gets built
twice, and the first build leaves a door open behind it.**

**Collapsed the same day.** `/api/relay/monitor`, `monitorMessage`,
`monitorSignatureOk`, `relay.setMonitor`, `hub.handleMonitor` and
`/api/hub/monitor` are gone. Nothing replaced them: the panel posts to
the relay the way it posts to a person, and `spirit/test/relayMonitor.js`
makes the same twenty checks it made before, through the packet.

Two things fell out that are worth having on the record, because they are
the argument for collapsing the other four:

- **The hand-rolled replay window was redundant too.** `monitorMessage`
  put the flag inside the signed bytes so a captured `start` could not be
  replayed as a `stop`. `postMessage` binds sender, recipient and the
  exact text, so it already covered that — the verb was buying a property
  the transport gives away.
- **The gate went with the door.** `setMonitor` re-derived the owner from
  `allow.byName` to decide who may ask. The post's own signature had
  already proved it. Two places deciding who the owner is, is one place
  to get it wrong, and every cheat below has its own copy of that code.

## The register

Every way of speaking on this wire, and what each one is. A new entry
requires a decision; `spirit/test/protocolSurface.js` goes red if the tree
holds one this list does not.

### The protocol

| | |
|---|---|
| `POST /api/relay/post` · `postMessage` | a peer drops a packet on a peer |
| `POST /api/relay/reply` · `receiptMessage` | the answer, by hash |
| `GET /api/relay/stream` · `streamMessage` | the wire itself |

### Bootstrap — cannot be a packet, by nature

| | |
|---|---|
| `POST /api/relay/claim` · `claimMessage` | **you cannot post to a relay you have no row on.** Permanently outside. |
| `GET /api/relay/who` | the public census, unsigned, and what a node reads *before* it has anything |
| `POST /api/relay/device` | posted by a browser that has **no identity yet** — that is the thing it is asking for |

### Died with the ring (R8) — **gone from the tree, 2026-09-15**

A table stood here holding `POST /api/relay/send` · `sendMessage` and
`GET /api/relay/inbox` · `inboxMessage`, under the line *"Not cheats —
they predate the router and are already sentenced."* The sentence has
been carried out, so the rows are struck rather than left: this register
fails in **both** directions, and a door listed here but absent from the
tree is as red as the reverse.

Named without backticks on purpose, so `protocolSurface.js` reads them as
history rather than as entries. That distinction is the same one the
worked example below depends on.

### Cheats, named

**There are none left.**

That line is the whole point of this decision, so it is worth saying what
it cost to get to and what it does not mean.

Five were named when this was written. `monitor` and `invite` collapsed
the same day, because the relay had just become addressable by its owner.
The other three were parked behind one sentence — *a relay is addressable
by its owner and by nobody else* — and that sentence turned out to be the
thing to examine rather than to plan around:

- **monitor** — the worked example. A packet the same day it was named.
- **invite** — a packet, and the mint-replay hole went with the format
  rather than needing a fix of its own.
- **remove-peer** — the owner's half first, because it only ever needed
  the relay to be addressable; the self half followed the moment the
  destination opened to peers at all.
- **set-device** — never an owner verb in the first place, so it only
  needed a door a peer could knock on. It got one, and then did not need
  it either: a relay keeps no device key, because the binding between a
  device and its node belongs to the node. Deleted rather than
  collapsed.
- **status** — still on the wire, and reclassified rather than collapsed.
  See below.

*(Written as prose and not a table on purpose: `protocolSurface.js` reads
table rows as the register, so a deleted name in a cell would read as a
claim that it still exists.)*

**What opened them all was one question of Andy's:**

> *"if `who` discloses the relay's key, why does the protocol forbid
> non-owner peers to obtain it as a destination?"*

It does not, and there was never a protocol reason. The key is published
unsigned in `/api/relay/who` — a node needs it to pin the box and to post
THROUGH it — so the refusal hid nothing. `postedToSelf` was doing
something else entirely: gating four owner verbs that check nothing
themselves, in one undifferentiated *is this the owner*.

Splitting that gate per verb is the whole change:

```
OWNER VERBS     monitor, invite, revoke, removing SOMEBODY ELSE
OWN-ROW VERBS   removing YOURSELF
```

Both kinds are proved by the same signature — the post's, checked once in
`routePost`. Only *which row it has to be* differs. With that split the
destination could open to any peer, and the last two cheats had nowhere
left to hide.

**Both kinds of refusal answer `no such peer`**, deliberately: an owner
verb asked by a peer and a verb nobody has heard of are indistinguishable,
so the set of things this box will do for somebody else cannot be
enumerated by asking.

### `GET /api/relay/status` — not a cheat, and not yet bootstrap either

| | |
|---|---|
| `GET /api/relay/status` · `statusMessage` | the owner badge, and the only thing still on this wire that neither the protocol nor bootstrap has claimed |

It stays on the wire, and it is off the cheat list because "cheat" was
the wrong word for it. A cheat is a verb invented because the protocol
could not carry it. `status` is a **read taken before this node has
anything to post with**, which is a different thing.

`presenceNode.start` calls `ownerBadge.probe`, which reads it to learn
which relays to open streams to; a relay answers a post on the asker's
stream, so a posted `status` would need a stream that does not exist yet.

**That is circular as ORDERED, not by nature** — an earlier draft here
said otherwise and was corrected. `streamOpen` refuses a token with no
row, and that refusal already answers "do I have a row here", so the order
could be: read `who` for the key, try a stream to each configured relay,
then post. What that costs is a connection attempt per row at boot and
disturbing an ordering with a deadlock scar on it.

**Open, and owed an argument.** Under the standing rule above, the
arrangement is what has to be defended — not the read.

## What a missing door taught this decision

The rule as written catches a protocol **extended** by hand. It said
nothing about one **absent**, and that turned out to be the more common
fault in this tree.

`relay.removePeer` had worked, been signed and been thorough since it
shipped, and **nothing under `run/` could reach it** — no route on the
node, no app that asked. A person could not remove anybody from their own
relay. Nothing about that was wrong anywhere a reader could see it: the
verb was correct, the route was correct, the register listed it honestly.
The defect was that the two never met.

`GET /api/hub/arrivals` was the same fault inverted — a door with no
caller, offering a weaker answer to a question `createArrivals.subscribe`
already answered better. Deleted.

Andy: *"These are the kind of things i wanted to know when asked about
impurities regarding protocol in the servers."* So the register is not
the whole inventory. **A verb with no interface and an interface with no
caller are both impurities**, and neither is visible to
`protocolSurface.js`, which can only compare two lists of things that
exist.

## Closed since this was written

- **`/api/relay/monitor` · `monitorMessage`** — deleted, with
  `relay.setMonitor`, `hub.handleMonitor` and `/api/hub/monitor`. Nothing
  replaced them.
- **`/api/relay/invite` · `mintMessage`** — deleted. `hub.handleInvite`
  keeps its door and posts underneath it; `relay.mint` takes no signature
  because the post already carried one. **The mint-replay hole closed as
  a side effect**, which is what this decision predicted would happen and
  the reason it was worth writing down rather than fixing the hole alone.
- **`/api/hub/remove-peer`** — the interface `relay.removePeer` never
  had. Adding it collapsed the owner's half of remove-peer into a post on
  the way.
- **`GET /api/hub/arrivals`** — deleted with `hub.rowAsMessage`. No
  caller, and catch-up was already solved on the live channel.
- **`/api/relay/remove-peer` · `removePeerMessage`** — deleted outright
  once the destination opened to peers. `relay.removePeer` split into
  `forgetPeer` (the act) and nothing else: the gate moved into
  `answerSelf`, one verb at a time.
- **`/api/relay/set-device` · `setDeviceMessage`** — deleted, with
  `handleSetDevice`. `relay.setDevice` became `installDevice(who, key)`,
  and `deviceTick` posts. The per-relay re-signing that format forced —
  because it carried no recipient — went with it.
- **Whether a relay should be addressable by more than its owner** — YES,
  and it was one question of Andy's that settled it. See "Cheats, named"
  above; the answer emptied that list.
- **Whether `GET /api/relay/status` is bootstrap** — **not settled.** An
  earlier entry here said it was, on the strength of a claim this
  decision itself later corrected. It has its own section above now,
  and it owes an argument rather than a classification.

## What is left

**One thing.** This section said *"two things"* until 2026-09-15, and the
second was carried out rather than re-argued.

1. **`GET /api/relay/status`** — the last thing on this wire that neither
   the protocol nor bootstrap has claimed. Moving it is a reordering of
   `presenceNode.start`, not a protocol change.

2. ~~The ring — `POST /api/relay/send` and `GET /api/relay/inbox`.~~
   **Done (R8).** Andy inspected what it was holding on spirit-3 before
   deciding: 77 messages, 15 of them telemetry from a console that no
   longer exists. *"they are all noise."* So the deletion needed no
   migration, and there was none: `loadRoutingTable` reads `messages` and
   drops it. Both signed formats went with the routes.

Everything else on this relay is either the protocol, a granted
exception, or gone.
