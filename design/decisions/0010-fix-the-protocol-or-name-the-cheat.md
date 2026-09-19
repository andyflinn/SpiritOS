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

### Naming is not a resting state — 2026-09-18

> **Andy:** *"there are cheats left and we know it. we will stop defending
> cheats."* — *"when a cheat is identified, it must be eradicated."*

Outcome 2 above reads as a place a thing may stay, and it is not one. A
name buys the time to do the work and nothing else: **identified means
scheduled.**

> **Andy:** *"and eradication of a cheat requires a plan. always."*

So it is three steps, not two, and the middle one is not optional:

| | |
|---|---|
| **identify** | say what it is and why it is a cheat |
| **plan** | write down what replaces each thing that depends on it, in what order, and what breaks — **before any of it is built** |
| **eradicate** | do that |

The plan is not ceremony and it is not the same as the naming. A cheat's
dependents each want something, and the plan is where it is established —
in writing, where somebody else can disagree — that the replacement
actually answers what they wanted. Skip it and the work proceeds by
whatever the person doing it happened to notice, which is how a feature
gets quietly dropped under cover of a cleanup.

**This rule was written because it was broken.** `relay.partnerCheck` was
moved off the census on 2026-09-18 within minutes of the census being
named, with no plan written first. It came out well and that is not the
point: it kept the refusal sentence only because somebody remembered it
was there, and the check for it was added after the fact rather than
demanded by a plan.

**And the reason it cannot wait is temptation, not tidiness.**

> **Andy:** *"the eradication must be done to eliminate temptation."*

A door that answers is an invitation. While the cheap wrong path exists it
is the one that gets taken — by the next session, by a person in a hurry,
with a perfectly good reason each time.
[0012](0012-a-relay-never-asks-for-a-member-list.md) already knew this in
another form: *"a refused verb is one somebody writes a bounded version of
in six months, with a good reason and a small limit, and then the limit is
raised once."*

So a scheduled eradication is not a completed one, and the schedule should
be short. **The code goes; the plan is how, not whether.**

The failure this closes is not a cheat going unnamed — this decision fixed
that — it is a cheat being *defended*. The shape it takes is always the
same, and it has taken it several times in this file's own history:
somebody asks what depends on the cheat, the dependents are listed, and the
list becomes the reason to keep it. It is not. **The dependents are the
work.**

And they are usually asking the wrong question. Everything removed from the
census between 2026-09-17 and 2026-09-18 — `peer.candidates`, `peer.find`,
`relay.roster`, the device page's label, `peer.list`'s whole-census sweep —
turned out not to need a member list at all. Five dependents, five wrong
questions, nothing built to replace them. That is the usual result of
collapsing rather than narrowing, which is why narrowing a cheat is a way
of defending it.

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
| `GET /api/relay/key` | it is where a node learns the relay's KEY. You cannot post to an address you are still asking for |
| `GET /api/relay/stream` | it is the wire itself. Posts are answered on this connection, so you cannot post to open the channel that carries the answer |
| `GET /api/version` | deliberately credential-free: *"the question a deploy check asks must not need a private key, or the check cannot run from anywhere but the owner's own machine."* A post needs a row; needing nothing is the point |

> ### The census hands its warrant to a smaller door — 2026-09-18
>
> > **Andy:** *"the first two are easily replaced with `GET /api/relay/key`
> > or whatever."*
>
> The row above was true of **key-learning**, never of the census. The census
> merely happened to be where the key was kept, and it inherited a bootstrap
> exemption that then covered every other caller — which is the correction
> already recorded further down this file, on Andy's *"violation!!"*, and
> which until now had no fix.
>
> `GET /api/relay/key` answers `{ relayPublicKey, relayLabel }` and nothing
> else: **fixed cost per request, with no membership term**, which is what
> earns an exemption under
> [0013](0013-a-relay-is-fixed-cost-per-time-unit.md). The census answered
> the same question at 151 bytes a member — ~147 KB at a thousand — once per
> relay per node boot.
>
> **Two, not three.** This is a swap: `who` keeps its row only until its
> remaining readers move, and it is listed above as holding a warrant it has
> already handed over. What it cannot do any more is claim that a signature
> is impossible on it, because the thing that was impossible now lives
> elsewhere.
>
> **And the caller asks nobody in steady state.** `answerRelay.relayKey`
> reads `relayKeys.pinned()` first and only opens this door when there is no
> pin. What that gives up is the per-boot substitution re-check — worth less
> than it looked, since it compared a pin against an **unsigned** answer from
> the box being checked. Substitution is caught where it actually shows:
> every signed exchange fails against a changed key. Evidence, not a poll.
>
> See [SURFACE.md](../relay/SURFACE.md) for the rest of the sequence.

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

> **`roster` deleted 2026-09-19 (cycle 3).** It sent the whole roll to each
> identity as its stream opened — a served member list, which 0012 (widened)
> forbids. A roll is reached by key or by search; a node learns presence from
> `presence` broadcasts and filters them by its own contacts.

Every way of speaking on this wire, and what each one is. A new entry
requires a decision; `spirit/test/protocolSurface.js` goes red if the tree
holds one this list does not.

### The protocol

| | |
|---|---|
| `POST /api/relay/post` · `postMessage` | a peer drops a packet on a peer |
| `POST /api/relay/post` · `hintMessage` | the sender's route hints, signed beside the packet over its `sig` and dropped at the first relay — **added 2026-09-19, cycle 2, locked in by Andy** (design/relay/SURFACE.md §8; design/cycles/2026-09-19-route-hints-cycle-2.md). Same door, a second signed field |
| `POST /api/relay/reply` · `receiptMessage` | the answer, by hash. **Also, since 2026-09-19 (cycle 2, Andy):** a relay may send the asker a `reply` for the hash signed with its OWN key — an error from the far side of a partnership passed down the chain (`relay.relayErrorToAsker`). Never the target's receipt: a node settles a reply signed by anyone but the target as a failure marked `relayed`. A new meaning for an existing word, not a new word |
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
| `presence` | one member arrived or left — broadcast |
| `route` | a route this relay **proved** — it carried a packet to that key through that partner and a reply came back signed by it. Broadcast, and forgotten here: the members that care write it down (0013) |
| `request` | a packet being delivered to the peer it is addressed to |
| `reply` | the answer to one, carried back on the asker's own stream |
| `relay-status` | what this box looks like, to the owner only, on membership change and on a stream opening or closing — never on a timer (0006) |
| `relay-event` | one routed thing happened. Opt-in (`monitor`), owner only, live only, never stored |
| `owner-event` | what this relay did about who belongs on it. Always on, owner only, and **kept** — see 0009 and the R2 note |

`presence` and `route` are the two broadcasts, and both say something
about a **peer** rather than about this relay — which is why neither is
correspondence and neither reaches a node's traffic log. A route is only
announced once it has been **proven**, because a false route cannot be
proven: verification is what lets a member's claimed route be shared
without trusting the member who claimed it.

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
| `relay-renamed` | the owner changed what the BOX calls itself — not a row on it | `was`, `label`, `cause` |
| `partner-added` | a peer here was promoted to partner — they own the relay at `relayAt` | `key`, `label`, `relayAt`, `cause` |
| `partner-removed` | that partnership was broken from this side | `key`, `label`, `relayAt`, `cause` |

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
| `POST /api/relay/device` | posted by a browser that has **no identity yet** — that is the thing it is asking for |

> ### The census exemption is too broad — corrected 2026-09-17
>
> > **Andy:** *"the census being public and unsigned is kind of a no-no as
> > well."* — *"violation!!"*
>
> The row above is **right for the first read and wrong for every read after
> it.** On first contact a node has no pin, cannot verify anything, and needs
> the key in order to pin it. Genuinely outside the protocol, and this decision
> was correct to say so.
>
> **The exemption was then inherited by every later use of the same route.** A
> node that already holds `relayKeys.pinned(url)` is not bootstrapping — it is
> querying a box it has already identified, and accepting an unsigned answer for
> no reason. Nine callers read this route; only the first read of a new relay is
> bootstrap.
>
> **And one of the later readers decides identity.** `peer.acquire` confirms
> *"key K really is on relay R"* by reading this document. Anyone who can
> interpose — a hostile proxy, a bad CA, an operator editing a file — can bind a
> **wrong key to a right label**, and acquire will confirm it. So identity
> acquisition currently rests on **CA trust rather than on keys**, which is the
> opposite of what 0001 means by *proven*.
>
> **The fix is cheap and does not touch bootstrap.** The relay signs the census
> with its relay key; a node verifies against the pin it already holds. First
> contact ignores the signature because it has nothing to check it against —
> exactly as today — and every read after the pin stops trusting the transport.
>
> **Separately, and much larger: `public` is a premise with dependents.** Four
> arguments elsewhere stand on *"the census is public in full"* — that a search
> over it gives away nothing new (`relay.js`), that a key in a device URL is a
> locator rather than a credential, that broadcasting routes discloses nothing,
> and that naming keys in a routing question is free. None is wrong today. All
> four become unsupported at once if that premise moves, and each would then need
> its own argument.

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

**One, named 2026-09-18.**

**There are none left again — the census was eradicated on 2026-09-18**,
the day after it was named. What follows is the account of it, in prose
rather than in a table row, because the register reads rows as things that
exist (see the note on `registered` in protocolSurface.js) and this one does
not any more.

It was `GET /api/relay/who`: a public, unsigned, unbounded read of every
member of a relay.

> **Andy:** *"the census mechanism is a cheat."*
> *"There is absolutely no reason for unbound entities to conduct surveys
> of our network."* — *"no node is entitled to a full member list from a
> relay."*

**It was filed above as a granted exception and that was wrong.** The
warrant it held — *"it is where a node learns the relay's KEY"* — was true
of key-learning and never of the census; the census merely happened to be
where the key was kept. `GET /api/relay/key` holds that warrant now, so the
row is gone from the granted table and the census stands here instead.

Three things make it a cheat rather than a feature:

- **It is a survey.** Unsigned and public, so bound and unbound cannot be
  told apart, and anyone who can reach the box gets every member's label,
  key and join date.
- **It could never have been protocol.** Its answer does not fit in a
  packet — 151 bytes a row against `PAYLOAD_MAX` 16384, so ~147 KB at a
  thousand members. A verb whose reply is undeliverable was never a verb.
- **Nobody is entitled to it.** [0012](0012-a-relay-never-asks-for-a-member-list.md)
  already says a relay never asks for a member list. The same holds on the
  other side.

**Eight readers, and not one needed a replacement.** That is the fact worth
carrying forward, because at the time each looked like a dependency:

| reader | what it actually wanted |
|---|---|
| `peer.candidates`, `peer.find`, `relay.roster` | nothing — no caller at all |
| the device page | a label for one sentence, on a page that has authenticated nobody |
| `peer.list` | to refresh a fallback label, and it handshook every member of the relay into that node's own book while it was there |
| `relay.partnerCheck` | who runs a box |
| `peer.acquire` | a label the relay had already said, in the search reply the person clicked |
| `ownerBadge.probe` | **what this node itself had done** — it asked each relay to remember its own claims |

What replaced it: `GET /api/relay/key` for who a box is and who runs it, 97
bytes and flat; `relayKeys.seat` for the node's own record of where it holds
a seat, written when the claim is granted; `peer.search` for *"who
matches"*, ranked and slot-bounded; and the stream for presence and routes,
pushed as they happen.

**The last one is the lesson.** `ownerBadge.probe` was the only reader that
was not a question about other people — the node was asking somebody else to
remember what it did, every boot, by downloading a membership. Andy:
*"persist necessary information at claim time, re-use that information on
boot."*

`ndPartnerCandidates` reads the roster too and is not a dependent: its own
comment says the picker may be empty and *"the fields remain the real
path."*

The collapse plan is [SURFACE.md](../relay/SURFACE.md). It is worth noting
what has already gone rather than been migrated — `peer.candidates`,
`peer.find`, `relay.roster`, the device page's label, and `peer.list`'s
whole-census sweep — because in every case the caller turned out not to
need a list at all. **A cheat's dependents are usually asking the wrong
question**, which is the argument for collapsing rather than narrowing.

---

Five were named when this was written, and the account of them stands,
because it is what the word "cheat" means here.

That line is the whole point of this decision, so it is worth saying what
it cost to get to and what it does not mean.

`monitor` and `invite` collapsed
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
   `publicLabel`, `publicKey`, `claimedAt`, `owner`, `relayPublicKey` and
   `relayLabel`, and the register knows none of them. A rename there
   breaks every node and this document would not notice.

   *2026-09-15: `relayLabel` was added to that list while this paragraph
   stood here saying it would go unnoticed, and it did.* The owner-event
   that accompanies it (`relay-renamed`) was caught immediately, by the
   scan added the same morning — so the two halves of one change met two
   different fates, which is the clearest argument this document has for
   closing the remaining gap. **The cost of registering a response shape
   is now known to be lower than the cost of the next rename.**
2. **The packet envelope.** `{app, v, id, body, re}` — now load-bearing
   for the client layer (`spirit/test/clientLayer.js`), and in no
   register at all.

Both are the same kind of thing as the stream events were: a way of
speaking that is not a door. Neither is urgent; both are cheaper to
register before something moves than after.
