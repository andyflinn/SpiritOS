# The shadow peer list — its structure, and what feeds it

**Design note, 2026-09-21. Every claim measured against `d83f05f`.
Nothing here is built.**

> **Andy:** *"we design the structure of the shadow-peer-list (which is
> both a subset and superset of the relay's member roll), we want to have
> labels updated as good as possible (the label/key pair), we then feed it
> at every opportunity via relay stream."*
>
> *"one gap I deliberately didn't mention yet is this consideration: the
> more relay events are streamed to all members, the more likely we have
> full/optimal coverage."*

Companion to [WHAT-A-NODE-KNOWS.md](WHAT-A-NODE-KNOWS.md), which asks what
a node does with what it is told. **This asks two narrower things: what
shape the row is, and which events earn a broadcast.**

---

## The rule this sitting extracts

**Rank first, recency second.** A statement about a peer is only as good
as the relay's standing to make it, and today's row keeps neither — it
keeps the last thing said.

That is the same shape the post scheduler already runs on: class outranks
age, age orders within a class (`postQueue.js`). The shadow needs it for
the same reason — several sources, unequal authority, arriving in an order
nobody controls.

---

## The gap Andy named is already decided in his favour

He raised streaming more events as an open consideration. **It is not
open. He decided it on 2026-09-18**, and the decision is stronger than the
question:

> `design/decisions/0012-a-relay-never-asks-for-a-member-list.md:61`
> @ `d83f05f` — *"But a broadcast is not a list — corrected 2026-09-18,
> same day."*
>
> **Andy, quoted there:** *"the working relay will broadcast useful
> information to its membership. Members can filter/use that, because
> bandwidth is generally cheap. A route is established and verified —
> that's a broadcast. **A member is added — broadcast it.** The member node
> that is actively listening can add the new member, put it in a queue for
> acquisition, or disregard it. Less work for the relay, more up-to-date
> information for the node."*

So the question is not *may* the relay stream more. It is **which of the
events it already fires are addressed to one listener when they were
licensed for all of them.**

### Four events exist, fire today, and go to the owner alone

| event | line @ `d83f05f` | who hears it | what it holds |
|---|---|---|---|
| `claim` — a member was added | `relay.js:1254` | **owner only** | `label`, `key` |
| `peer-renamed` — a label changed | `relay.js:1767` | **owner only** | `key`, `was`, `label` |
| `peer-removed` | `relay.js:1855` | owner, **and** all members as `presence {gone:true}` (`relay.js:1845`) | key |
| `partner-added` | `relay.js:803` | **owner only** | the partnership itself |

`ownerEvent` is one sink by construction — `relay.js:3451` @ `d83f05f`:
*"`presentNow.send(ownerKey, …)` addresses ONE sink."*

**`peer-renamed` is the one that matters most for what Andy asked.** It is
the *only* moment a relay knows a label changed, it fires already, it
carries the exact `{key, label}` pair he wants kept fresh — and every
member's node is told nothing. A node learns the new name only if it later
runs a search, or receives a route announcement that happens to carry it.

**And `claim` is the one 0012 names by hand.** *"A member is added —
broadcast it"* is in the decision; the code sends it to the owner.

---

## The eighth discard: presence, which is a route

[WHAT-A-NODE-KNOWS.md](WHAT-A-NODE-KNOWS.md) lists seven places knowledge
was being thrown away. **Here is the eighth, and by volume it is the
largest of them.**

A relay broadcasts `presence {key, present}` to every member on every
arrival and every departure — `relay.js:3741`, `:3797`, `:3827`, `:1845`
@ `d83f05f`.

The node drops most of them:

> `presenceNode.js:181` @ `d83f05f` —
> `if (knows && !knows(body.key) && byRelay[url][body.key] === undefined) return;`
>
> and `knows` is `server.js:1062` @ `d83f05f` —
> `function (key) { return !!contactBook.byPublicKey(ROOT_DIR, key); }`

**A presence event about a stranger is discarded whole**, and with it the
`url` it arrived on. That URL is the thing the node is short of: *this key
is on that relay, and the relay said so about its own member.* It is the
highest-authority route statement in the system, it arrives free, and it
arrives for **every member of every relay this node is on**.

It is also the only route source that needs no traffic at all. A node
learns routes today by searching, by posting, or by being posted to — all
of which require somebody to act. Presence arrives because other people
are living their lives.

**Presence carries no label**, which is the other half. Adding one makes
the arrival event answer both questions at once.

---

## Subset and superset — what it actually is

Andy's framing, stated precisely, because it decides the bounds:

| | against one relay's roll |
|---|---|
| **subset** | it holds only peers this node has had dealings with, or been told about; a roll holds everyone |
| **superset** | it holds peers from *every* relay this node touches, plus peers reached through partners who are on no relay it knows |
| **neither** | it is time-lagged and may be wrong; the roll is canonical and it is not |

That last row is the licence to exist at all — `seenPeers.js:79`
@ `d83f05f`: *"IT MAY GUESS AND MAY NEVER ASSERT."*

**The superset direction is what bounds it.** Growth is not *members of my
relay*; it is *everyone I have been told about, anywhere*. With presence
feeding it, the floor becomes the sum of the memberships of every relay
this node is on — which is why `MAX_ENTRIES = 500` (`seenPeers.js:92`)
stops being a generous bound and becomes the binding one.

---

## Proposed shape

Today — `seenPeers.js:101` @ `d83f05f`:

```
key -> { at, url, label, seen }
```

One timestamp for the whole row, one route, and no record of who said any
of it. Three consequences, all live:

1. **A second-hand label overwrites a first-hand one.** A search answer
   relayed through a partner and a `peer-renamed` from the peer's own
   relay are indistinguishable once written.
2. **A peer on two relays cannot be held.** `at` is single-valued, so a
   second route silently replaces the first.
3. **Which of my own relays proved it is not kept** — the open `via` item
   (cycle R1), and the reason a node on three relays cannot tell which
   door works.

### Proposed

```
key -> {
  label:  { v, at, rank },                 // one value, with its provenance
  routes: [ { at, url, via, rank, told } ], // capped, best-ranked first
  seen,                                    // last sighting of any kind
}
```

- **`at`** — the far relay's key, which is what a route is made of.
- **`via`** — which of *this node's* relays carried the statement. The
  missing field; without it a route cannot be retried through the door
  that proved it.
- **`rank`** — the authority of the source, below.
- **`routes` is a short list, not a value.** Cap at 3. A peer on several
  relays is normal, a node on several relays is normal, and one slot
  loses information for no saving.

### The rank ladder

| rank | source | authoritative for |
|---|---|---|
| **1 — the host says so** | `presence`, `claim`, `peer-renamed`, from the relay the peer is a member of | **label and route.** The relay holds the row it is describing |
| **2 — proved by signature** | a route announcement after a verified reply (`relay.js:2196`, and the sibling pair at `relay.js:3314`) | **route.** `relay.js:2186` @ `d83f05f`: *"A reply signed by the target key cannot be produced by anyone who does not hold that key"* |
| **3 — a packet arrived** | `peerPost` inbound | **route** — it demonstrably came from there. Not label |
| **4 — second-hand** | a search answer carried by a partner | both, weakly |

**Higher rank always wins. Equal rank, newer wins. Lower rank never
overwrites higher** — except where the higher statement has aged past its
own usefulness, which is what `rank` plus a per-field timestamp lets the
row decide instead of guess.

This preserves the greedy rule (`seenPeers.js:122`, *"never blanking what
it knows"*) and adds the one thing greed alone cannot do: refusing a
**downgrade**. Greedy today means a worse answer that arrives later wins.

---

## The cost, and the one number that decides it

**0013's test** — `design/decisions/0013-a-relay-is-fixed-cost-per-time-unit.md:16`
@ `d83f05f`: *"Does this make a relay's cost a function of anything other
than time?"*

0012's cost table answers *"O(1) per event, one write per listener"*. **The
per-listener multiplier is the N**, and the table does not carry it
forward. Stated honestly:

> broadcast cost = **O(members) per event × event rate**, and the event
> rate is itself driven by member activity.

For presence that is `O(N²)` in the worst case — every member flapping
tells every member. At 9 members (spirit-3, 0012's own measurement) it is
nothing. At 1000 it is not.

**This is not an argument against Andy's instinct; it is the boundary on
it.** Coverage improves linearly with events streamed; cost grows as
N × rate. So the events that earn a broadcast are the ones that are
**rare, durable, and unobtainable any other way** — and that is exactly
the set already going to the owner:

| event | rate | durable | reachable otherwise |
|---|---|---|---|
| `peer-renamed` | very rare | yes, until renamed again | **no** — nothing else reports a rename |
| `claim` | rare | yes | only by a later search |
| `presence` | **high — it is the flapping one** | no, it is about right now | no |

**`peer-renamed` and `claim` are cheap and are not broadcast. `presence`
is the expensive one and is broadcast already.** The arithmetic points the
opposite way from the current code.

---

## Decided

Nothing new. Two standing decisions cover this ground, and both are cited
above rather than restated: **0012 as corrected** (a broadcast is not a
list; a member added is broadcast) and **0018** (the route cache belongs to
the machine, so its shape is the machine's to choose).

## Recommended, not decided

1. **Broadcast `peer-renamed` as `{key, label}`.** Highest value, lowest
   rate, no other source. Members only, about that relay's own member.
2. **Broadcast `claim` as `{key, label}`** — 0012 names it in Andy's own
   words, and the code sends it to one listener.
3. **Carry `label` on `presence`.** No new event, no new rate.
4. **Stop discarding presence about strangers** (`presenceNode.js:181`).
   Keep the filter for the *presence picture*, which is about contacts;
   feed the shadow from every event, which is what it is for.
5. **Adopt rank-plus-provenance**, `routes` as a capped list, and `via`.
6. **Reconsider `MAX_ENTRIES = 500`** with the store (cycle R26). Presence
   feeding makes the floor the sum of memberships rather than this node's
   own traffic.

## Open

- **What a rename costs at scale.** `peer-renamed` is argued rare here and
  has never been measured. If labels churn, recommendation 1 is the cheap
  one only on paper.
- **Whether `presence` may carry a label at all.** It is broadcast to
  every member about every member, so adding the name lets a long-lived
  listener assemble `{key, label}` for the whole roll over time. 0012 says
  *"Membership is not secret from members"* (`:88`) — but it says it
  while a full census is **already public** at `/api/relay/who`, and that
  census is being eradicated (`SURFACE.md` §10). **The premise may not
  survive its own cleanup. Andy's to decide, not mine.**
- **Label-key tuplets on request and reply**, carried over from
  [WHAT-A-NODE-KNOWS.md](WHAT-A-NODE-KNOWS.md) and still undecided:
  `limits.js:74` @ `d83f05f` — `WIRE_OVERHEAD = 246`, measured.
- **Negative results.** Unchanged and still open from
  [ROUTE-DISCOVERY.md](ROUTE-DISCOVERY.md): nothing here gives the shadow
  a way to record that a peer is *not* somewhere.

## What this does not touch

**Every item above is a wire change or a new broadcast**, which is a team
review by `CLAUDE.md` and not Claude's to build alone. The one exception is
recommendation 4 — `presenceNode.js` discarding what it already receives —
which changes no packet and is node-side in-file work.
