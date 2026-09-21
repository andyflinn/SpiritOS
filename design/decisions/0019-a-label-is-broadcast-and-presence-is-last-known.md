# 0019 — A public label is broadcast at every level, and presence is last-known

**Decided 2026-09-21 by Andy. Measured against `17db255`.**

> **Andy:** *"add public Label change to broadcast, at all levels. A user
> changes a public label, it goes to all relays, a relay receives a
> label-change-post, it is broadcast to members."*
>
> *"on presence for strangers: it should be streamed to requesters when
> the stranger is returned in a search → green; when a request to stranger
> gets a reply from stranger, no matter what reply stranger goes green; as
> soon as stranger cannot be reached in a post stranger goes NOT-green."*
>
> *"rule: presence is always last-known, and since the shadow-roll has
> updated-time-stamps, the info is true."*

Two rulings. They settle
[SHADOW-PEER-LIST.md](../relay/SHADOW-PEER-LIST.md)'s recommendations 1–4
and one of its open items.

---

## Ruling 1 — a public label change reaches everybody, at every level

**A label is not a private fact and never was.** It is what a person calls
themselves in public, so the moment it changes, every party holding the old
one is holding something wrong. The chain is three hops and each was
already half-built:

| hop | today @ `17db255` | under this decision |
|---|---|---|
| owner → their relays | `peer.post` with `{rename:{label}}`, **to one relay**, driven by the browser (`server.js:723`, `relay.js:2563`) | the node fans it to **all** relays it is a member of |
| relay → its members | `ownerEvent('peer-renamed')` — **one sink** (`relay.js:1767`, `:3451`) | broadcast `{key, label}` to every member |
| member node → its own state | `onRoute` already takes a label when one rides along (`server.js:1162`) | the same path, now fed by an event that exists for it |

**The verb already exists and already works.** `renameSelf` (`relay.js:1710`)
is a peer renaming its own caption, reached as an ordinary post. Nothing
new goes on the wire at the first hop — what is missing is that the node
sends it once instead of everywhere, and that the relay tells one listener
instead of all of them.

**Why this is the cheap broadcast.** From SHADOW-PEER-LIST's arithmetic: a
broadcast costs `O(members) × event rate`, so the events that earn one are
**rare, durable, and unobtainable otherwise**. A rename is all three. It is
the *only* moment anybody learns a label changed, and until now that moment
was spent on a single listener.

**`claim` goes with it**, per 0012 as corrected — *"A member is added —
broadcast it"* — which has been the decision since 2026-09-18 while the
code sent it to the owner.

### What it does not do

**It does not cross a partnership.** A label change reaches the members of
the relays the person is a member of, and stops. A stranger on a partner
relay learns the new name the next time they search or exchange a packet.
That is correct and is not a gap: a relay speaks for its own members
(`relay.js:1423` — *"labels serve search and display only"*), and a
partner relaying a name it was told is second-hand by construction —
**rank 4** on SHADOW-PEER-LIST's ladder.

---

## Ruling 2 — presence is last-known, and a stranger's mark comes from traffic

### The rule

**Presence is always last-known.** It is not a claim about now. Paired with
the shadow's timestamps, *"present as of 14:02"* is a **true statement**,
and stays true however old it gets.

This is a real change of footing. The current model treats presence as
live, and therefore as something that must be forgotten when it cannot be
refreshed — `contacts.js:271`: *"FALSE NEGATIVES ONLY. Anything unknown,
stale or unreachable reads as white — the mark that promises nothing."*
Under last-known, stale is not the enemy; **undated** is.

### Where a stranger's mark comes from

Three sources, and none of them is a new broadcast:

1. **Returned in a search → green.** Search is online-only since
   2026-09-19, so every row it returns is present at the relay that
   answered — `hub.js:1868` drops anything marked absent, and `:1936`
   sets `present: true` on every surviving row. **The green is already
   correct and already delivered; what is missing is the timestamp beside
   it.**
2. **A reply to a post → green, whatever the reply says.** A refusal, an
   error, a rejection: all of them prove the person was reachable, which is
   the only thing presence claims. The content is a separate matter.
3. **`503 peer not reachable` → NOT-green, and it is streamed.**

> **Andy:** *"requests that fail with 'not-available' also generate a
> streamed update of the shadow-roll."*

**This is the one that was being wasted.** `relay.js:1579`, `:1996` and
`:3094` already refuse a post with `503 peer not reachable` — a relay
saying, about a peer it holds a row for, that nobody is on the other end.
First-hand, on a path the node already reads, and today it ends its life
as a failed post and nothing else.

It costs nothing new: the refusal is already on the wire and already
addressed to the node that asked. What changes is that the node writes it
down.

### What this decision settles, and what it leaves

**Settled: the relay does no extra work for stranger presence.** This
ruling closes the open item SHADOW-PEER-LIST raised —
*"whether `presence` may carry a label at all"* — by removing its premise.
There is no broadcast about strangers to worry about, no per-requester
subscription to maintain, and therefore nothing from which a long-lived
listener could assemble a roll. **A node derives a stranger's mark from its
own traffic, which is what the shadow already is.**

**Read as adopted, flagged for correction in one word.** *"streamed to
requesters when the stranger is returned in a search"* is read here as
**the search answer itself carrying presence** — which it does today —
rather than as a standing per-requester subscription on the relay. That
reading is what makes the ruling self-consistent: a subscription would be
live presence, and the rule says last-known. If a subscription was meant,
this section is wrong and the cost is a per-requester registry on the
relay, which 0013 would have to be argued against.

**NOT-green is deliberately not spelled as a colour here.** The screen has
three marks (`contacts.js:261`): green *present*, red *a relay you share
says absent*, white *nobody mentioned them*. A failed post is neither —
something was tried and failed, which is more than white knows and less
than red claims. **Open**, and the existing tie-break applies until it is
decided: the mark that promises less.

### Where it is kept

> **Andy:** *"shadow-roll track presence in a time-stamped fashion."*

**Presence becomes a field on the shadow row, and the row's own timestamp
dates it.**

> **Andy:** *"the presence-time-stamp is implicit in the last-updated
> timestamp of the shadow-roll-row."*

```
present: v          // dated by the row's `seen`, not by a field of its own
```

**Not the provenance triple a label gets**, and the difference is the
point. Sources disagree about a name, so `label` carries who said it;
nothing disagrees about whether the last evidence was positive. *"Present,
as of this row's last update"* is the whole statement, and one timestamp
for the row carries it.

Not a separate table and not the live presence picture, which stays what it
is — `presenceNode`'s merge of the rosters of relays this node holds a
stream to, about this node's own contacts (`server.js:1062`).

**The two are different claims and both are wanted.** The picture answers
*"is a relay I share telling me right now"*; the shadow answers *"when did I
last have evidence, and how good was it"*. A stranger has no entry in the
first and can have one in the second, which is the whole of what this
ruling adds.

**`at` is what makes it true rather than stale**, and it is the same field
the row already carries for everything else — one shape, one rule: a value,
when it was learned, and who said it.

### A sibling becomes visible, and presence for one is live

> **Andy:** *"The fact that we log full routes for same-relay targets also
> lets the node-machine know if a target is a sibling, and that the
> presence bit is more responsive...."*

**This falls out of R23 and was not the reason for it.** Siblings now
announce to both ends (`relay.js:3314`), so the shadow's `at` for a
same-relay peer is a relay key **this node already holds** — and the node
can compare it against its own (`relayKeys.pinned`,
`presenceNode.relaysNaming`).

It could not do that before, which was the whole difficulty Andy named
when R23 was opened: *"because the node doesn't 'know' it is a sibling."*
It knows now, and it knows it from a field that was added for routing.

**And a sibling's presence is not last-known — it is live.** The node holds
a stream to that relay, so `presence {key, present}` for that peer already
arrives, unasked, on every arrival and departure. Two classes, and the row
can tell them apart:

| target | presence | refreshed by |
|---|---|---|
| **sibling** — `at` is one of my own relays | **live** | the relay's own broadcasts, as they happen |
| **foreign** — `at` is somebody else's relay | **last-known** | this node's own traffic |

**This is what R27 unlocks and why it is worth more than it looks.**
`presenceNode.js:181` drops a presence event about a non-contact — and a
sibling stranger is exactly that: somebody on a relay this node is on,
whose presence is being delivered free and thrown away. Feeding the shadow
before the filter gives live presence for every sibling at no cost, which
is the most responsive presence in the system.

---

## The one thing this decision obliges

**Last-known is only true if the age is visible.**

The rule holds in the data — the shadow carries `seen`, and *"present as of
14:02"* is true for ever. It does **not** hold on the screen. A green dot
with no age next to it is read as a live claim by everybody who looks at
it, and an hour-old green would then be exactly the false positive the
current model was built to avoid.

So the timestamp is not an implementation detail of this decision, it is
the part that makes it honest: **wherever a mark is shown, its age is
available.** A tooltip is enough; `contactsPresenceTitle`
(`contacts.js:288`) is already the place, and already writes a sentence
rather than a word.

---

## Retrofitted

- [SHADOW-PEER-LIST.md](../relay/SHADOW-PEER-LIST.md) — recommendations 1–4
  decided, and the label-on-presence open item struck with its premise.
- [the gap cycle](../cycles/2026-09-21-filling-the-gaps-request-budget.md) —
  R28 amended from *not decided* to decided-and-unbuilt, with the fan-out
  hop added; R30 added for the presence rule and its visible age.
- **Not retrofitted, and named so it is not missed:** `contacts.js:271`'s
  *"FALSE NEGATIVES ONLY"* still stands as written, because this decision
  changes what makes a mark honest (an age) rather than the preference for
  promising less. It is amended in place when R30 is built, not before.
