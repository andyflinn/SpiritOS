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
outstanding when this was written; **both have since gone.** `GET
/api/relay/inbox` died with the ring (R8) and `GET /api/relay/status`
with the owner badge (R3), both on 2026-09-15.

So the rule holds with **no outstanding exemptions.** Every GET a relay
answers is a static file, the public census, the stream, or
`/api/version`. Everything else is a post.

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

### What travels on the stream

**The register counted doors, not packets, and that was a hole it fell
through twice.** `GET /api/relay/stream` is one row above, and seven
different things go down it. On 2026-09-15 an eighth was added —
`owner-event`, for the membership log — and nothing went red, because the
door had not changed. The same blindness let `mailboxPublicKey` be renamed
to `relayPublicKey` on a published response with no register entry
disturbed.

A door is a way of speaking. So is a word said through it.

| event | what it is |
|---|---|
| `roster` | who this relay holds, sent to one identity as its stream opens |
| `presence` | one member arrived or left — broadcast, and the only broadcast here |
| `request` | a packet being delivered to the peer it is addressed to |
| `reply` | the answer to one, carried back on the asker's own stream |
| `relay-status` | what this box looks like, to the owner only, on membership change and on a stream opening or closing — never on a timer (0006) |
| `relay-event` | one routed thing happened. Opt-in (`monitor`), owner only, live only, never stored |
| `owner-event` | what this relay did about who belongs on it. Always on, owner only, and **kept** — see 0009 and the R2 note |

Two of these are deliberately not one. `relay-event` is traffic and is
forgotten; `owner-event` is membership and is written down. One event name
for two retention rules would put the decision about whether somebody's
words reach disk inside a string comparison.

### What the owner is told

**The register learned to count events instead of only doors, and still
counted `owner-event` as one row.** Six different things go down it. That
is the hole above, recursing: a door is a way of speaking, a word said
through it is another, and so is what the word says.

> Andy: "there are events that the owner node should be notified of, no
> matter if natter is probing, we simply have not identified them
> formally."

It matters more here than one level up. These are the only things a relay
ever says to its owner unprompted; they are the ones 0009 says are
**kept**; and until 2026-09-15 nothing in a browser received any of them,
so a seventh could have been added and read by nobody — exactly as an
eighth stream event was.

| kind | what it says | carries |
|---|---|---|
| `claim` · `claim-refused` | somebody tried to take a seat, and how it ended. One call site, two outcomes, so one row | `label`, `invite`, `key`, `owner`, `why` |
| `invite-minted` | the owner wrote an invite | `invite`, `expiresAt`, `cause` |
| `invite-revoked` | an invite was withdrawn, with how many rows it took | `invite`, `revoked`, `cause` |
| `peer-renamed` | somebody changed what this relay calls them | `key`, `was`, `label`, `cause` |
| `peer-removed` | a row is gone, and what went with it | `key`, `label`, `invitesRevoked` |

**`invite` is a LABEL, never a token.** The word the owner wrote on the
invite, normalised — `seen.invite = normalizeName(inviteLabel)`. A token
is a secret and does not travel on an event that is written to disk.

**`key` is what a consumer acts on, and `label` is only for display.** A
label is a caption: two peers may wear one, and the same peer may change
theirs. Anything that decides something — acquiring a contact, removing a
row — reads `key`. The one place in the tree that resolved a label back
to a key in order to act (`natterAcquireInvited`, matching a minted label
against the census) is deleted by this decision's own logic: `claim`
already carries the key.

**`cause` is which post caused it**, absent on `claim` because a claim
arrives on a route rather than as a post — see the `cause` note in
`relay.ownerEvent`.

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

### `GET /api/relay/status` — **gone from the tree, 2026-09-15**

A table stood here holding `GET /api/relay/status` · `statusMessage`,
under the line *"the owner badge, and the only thing still on this wire
that neither the protocol nor bootstrap has claimed."* Struck, because
this register fails in **both** directions and a door listed but absent
is as red as the reverse.

**It was not reclassified. It was deleted**, and by the question this
section kept asking answering itself.

The argument here ran: `presenceNode.start` calls `ownerBadge.probe`,
which reads status to learn which relays to open streams to — and a relay
answers a post on the asker's stream, so a posted `status` would need a
stream that does not exist yet. The note beneath already conceded the
circle was *"circular as ORDERED, not by nature"*.

Andy went past the ordering to the thing it was serving:

> i don't understand the ownerbadge concept at all: the relay knows its
> owner by key, and already filters requests by that, because the owner
> gets a wider peer-post-api than non-owning peers.

The badge was `status`'s only caller, and it was redundant three ways
over: `owner: true|false` is on every census row already, unsigned;
`statusToOwner` reaches only the owner's key, so receiving one IS the
badge; and `answerSelf` decides `isOwner` from the post's own signature,
per verb. `ownerBadge.claimedFrom` was already parsing the very list that
carries the flag and not reading it.

So there is no reordering, no posted `status`, and no read. The last
thing on this wire that neither the protocol nor bootstrap had claimed is
not classified — it is not there. See
[R3](../cycles/2026-09-15-labels-are-not-identities.md).

**What it took with it.** `statusMessage` was the last signed format
naming a LABEL rather than a key, and the only one carrying no minute —
so it could not expire, and it travelled on a query string, where
`relay.streamSignatureFrom` refuses its sibling outright. `checkOwner`
went too; it had no other caller.

Named without backticks above, so `protocolSurface.js` reads this as
history rather than as an entry.
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
- **Whether `GET /api/relay/status` is bootstrap** — **never settled, and
  no longer a question.** An earlier entry said it was; this decision
  corrected that and left it owing an argument. It was deleted instead
  (R3, 2026-09-15). A classification nobody has to make is the cheapest
  answer available, and it came from asking what the route was FOR rather
  than what it was.

## What is left

**Nothing.** This section said *"two things"*, then *"one thing"*, and
both were carried out rather than re-argued — on the same day, by the
same cycle's neighbour.

1. ~~`GET /api/relay/status`~~ — **Done (R3).** Deleted rather than
   classified, along with the owner badge that was its only caller,
   `statusMessage` and `checkOwner`. See the section above.

2. ~~The ring — `POST /api/relay/send` and `GET /api/relay/inbox`.~~
   **Done (R8).** Andy inspected what it was holding on spirit-3 before
   deciding: 77 messages, 15 of them telemetry from a console that no
   longer exists. *"they are all noise."* So the deletion needed no
   migration, and there was none: `loadRoutingTable` reads `messages`
   and drops it. Both signed formats went with the routes.

The register is now the protocol, three granted exceptions, and
history. There is no third category with anything in it.

Everything else on this relay is either the protocol, a granted
exception, or gone.

## What the register could not see, until 2026-09-15

**It counted doors and not packets.** Every entry above is a route or a
signed format, and for months that was taken to be the whole surface. It
is not: `GET /api/relay/stream` is one row, and **seven different things
go down it**.

The hole was found by falling through it twice in one day. An eighth
event — `owner-event`, carrying the membership log — was added and
nothing went red, because no door had changed. Then `mailboxPublicKey`
was renamed to `relayPublicKey` on a published response, which is a
change every node in the world must follow, and the register was equally
silent.

So *What travels on the stream* is now a section above, and
`protocolSurface.js` compares it against `presentNow.send` and
`presentNow.broadcast` in both directions like everything else.

**What is still unregistered, named rather than left to be discovered
again:**

1. **The fields on a published response.** `/api/relay/who` answers
   `publicLabel`, `publicKey`, `claimedAt`, `owner` and `relayPublicKey`,
   and the register knows none of them. A rename there breaks every node
   and this document would not notice.
2. **The packet envelope.** `{app, v, id, body, re}` — now load-bearing
   for the client layer (`spirit/test/clientLayer.js`), and in no
   register at all.

Both are the same kind of thing as the stream events were: a way of
speaking that is not a door. Neither is urgent; both are cheaper to
register before something moves than after.
