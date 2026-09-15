# Partner relays — one hop, and no further

**Shape agreed 2026-09-15. Nothing here is built.** Every claim about the
tree below was checked at `02f4bd1`.

> **Andy:** "if you can verify a peer, and we can verify each other, then
> I can verify your peer."

That sentence is the whole contract, and it is also the reason it stops
where it does. It names exactly three parties — me, you, your peer — and
each link is one I can check myself. *Your peer's peer* would require me
to trust a relay I never verified, which is where a web of trust begins
and inspectability ends.

> **Andy:** "the partner nodes only reach one level. We're currently not
> needing 6 degrees of separation."

> **Andy:** "referrals must be verifiable."

That is the generalisation, and it is what makes the reciprocity check the
load-bearing part rather than a formality. A referral nobody can check is
a rumour, and a relay that routes on rumour is a relay that can be talked
into anything. Every link in the chain above is checkable **by the party
relying on it, against public data, by key** — which is the only kind of
referral this design accepts.

## And the memory model forbids the second hop anyway

> **Andy:** "the highest memory demand on a relay comes from peerlist ×
> peerlists… that can only go max one hop."

This is the stronger argument, because it does not depend on anyone
agreeing about trust. If a relay holds its partners' member lists:

```
held rows  =  partners × members          (one hop)
           =  partners² × members         (two hops)
```

Measured against the live box — spirit-3 answers 9 rows in 1390 bytes, so
~154 B/row as JSON and call it ~460 B/row held as objects:

| partners | members each | one hop | two hops |
|---|---|---|---|
| 10 | 100 | 1 000 rows · 462 KB | 10 000 rows · 5 MB |
| 50 | 500 | 25 000 rows · 12 MB | 1 250 000 rows · **578 MB** |
| 100 | 1 000 | 100 000 rows · 46 MB | 10 000 000 rows · **4.6 GB** |

spirit-3 is a **~1 GB VPS**. One hop stays comfortable to a hundred
partners of a thousand members each. Two hops kills the box somewhere
around fifty partners — and the growth is quadratic, so it kills it
suddenly, on somebody else's decision to add a partner.

**That is the rule's real enforcement.** "We do not need six degrees" is a
preference and could be revisited; `partners² × members` on a 1 GB box is
arithmetic and cannot.

## Declining and cancelling — survival is part of the design

> **Andy:** "relays will have to decline or cancel partnerships for
> survival. and pick its optimal partners based on a very smart algorithm
> (not necessarily very complicated)."

> **Andy:** "and somehow measure route-usage in memory to real-time
> optimize… all this later, of course, first the principal mechanisms need
> to go green."

**Everything in this section is LATER, and that is a decision rather than a
caveat.** It is written down now because the sequencing question — *do I
need the ranking before the flag?* — has an answer, and the answer is no.
A relay with partners and no policy is a relay that accepts everything
until an owner says otherwise, which is exactly how it behaves today about
everything else.

Read this section as *the shape the optimisation will take when it is
wanted*, not as work queued behind the flag. The build order at the foot of
this document is the real sequence.

### A relay NEVER persists a partner's ledger

> **Andy:** "the relay must NEVER persist a partner's ledger. that's a
> hard rule. It is of no use anyway if the partner is not online and
> alive."

**Hard rule, and the reasoning removes a whole section of this document.**
A cached list for an unreachable partner buys nothing: you cannot forward
there anyway. And if the partner *is* reachable, you can ask. So
persistence has no case to make — the list is worth exactly as much as the
partner's liveness, and no longer.

What follows from it:

- **0006 needs no carve-out.** Nothing is stored on anyone's behalf,
  because nothing is stored. The recommendation to write one is withdrawn:
  it was solving a problem this rule deletes.
- **Restart is empty and that is correct**, not a gap to warm. `routes`
  already behaves this way; a relay that came back knowing things it had
  not been told since boot would be the strange one.
- **`routingTable.json` keeps its shape** — `peers` and nothing else, which
  `labPersistence` asserts and which is the whole of 0006 on disk. The
  `partner` flag lives on a peer row, so it persists; the *list* has
  nowhere on disk to be.

### And the lifetime is already measured — it is presence

The rule hands over the cache policy for free, which is the part I would
otherwise have got wrong with a TTL.

Reciprocity means the partner's owner **is a peer on this relay**. So
`presentNow.isPresent(theirOwnerKey)` — which the relay already answers,
and already uses to decide whether it can deliver at all — is exactly the
liveness signal the route table's lifetime should follow:

| moment | what happens |
|---|---|
| their owner's stream opens | add their routes to the table |
| while present | route from it |
| their stream closes | remove their routes; evict any peer left with none |
| ever | never write it down |

No TTL, no invalidation, no staleness policy, no reconciliation. The list
exists precisely while it could be used and not one second longer, and the
mechanism that decides is one a relay already runs for every peer.

That also means the **memory ceiling is bounded by who is online**, not by
how many partnerships an owner has accumulated — which is a far better
bound than the row budget I proposed, and makes that budget a backstop
rather than the policy.

### Which makes this a network that needs more RAM than disk

> **Andy:** "we're designing a network that requires more RAM than
> discspace."

It is already true and this makes it truer. **spirit-3's entire persistent
state is about 2.3 KB** — `routingTable.json` at ~1400 B for nine peers,
`allow.json` ~200 B, `identity.json` ~350 B, a few hundred for invites.
That is the whole of what survives a reboot.

Everything a relay is actually *doing* lives in RAM and dies with the
process: held streams, the presence registry, routes in flight, rate
counters, and now partner lists. None of it is written, none of it is
recovered, and that is the design rather than a shortcut — 0006 is the
disk half of the same sentence.

Consequences worth naming, because they run against the instinct:

- **Size a relay by RAM, never by disk.** "It is filling up" is not a
  failure mode this system has; "it is holding too much at once" is the
  only one.
- **Backup is a copy of a few kilobytes**, and losing the disk loses the
  identity and the roster — everything that makes it *this* relay — while
  losing the RAM loses only what it was mid-way through.
- **Adding disk is never the answer to anything.** If a relay is in
  trouble, the answer is fewer things held, which is what the shedding
  policy above is for.

This is the opposite shape from a mail server, and deliberately: a mailbox
accumulates and a relay does not. It is what "a relay relays" costs, and
what it buys.

### It is one route table, not a list per partner

> **Andy:** "when a partner's ledger is cached in RAM, it can already
> filter out peers it can reach already, let's say over 2 routes or
> whatever is configured — that flattens the exponentiality of RAM usage."

This changes the **data structure**, not just its size, and the earlier
framing in this document ("hold the partner's member list") was the wrong
shape. What a relay holds is:

```
key → { row, routes: [partner indices], capped at N }
```

One entry per **distinct peer**, carrying up to N ways to reach them. Not
one list per partner with the same popular peer copied into every one.

**Two different wins, and the second is the one that matters.**

Deduplication pays off with overlap, and overlap is the realistic case —
relays that partner with each other serve communities that intersect. At
`ref = 8 B` (a route is an index into a ≤255-entry partner array, not a
copy of anything):

| partners | members | overlap | list per partner | one capped table | |
|---|---|---|---|---|---|
| 10 | 100 | 30% | 460 KB | 333 KB | 1.4× |
| 50 | 500 | 60% | 12 MB | 5 MB | 2.4× |
| 100 | 1000 | 80% | 46 MB | 10 MB | 4.8× |
| 100 | 1000 | 95% | 46 MB | 2 MB | 19× |
| 100 | 1000 | **0%** | 46 MB | 48 MB | 1.0× |

That last row is honest: with no overlap at all, dedup buys nothing and
the refs cost a little. It is not the case to design for, but it is the
case that says *the cap is doing the real work, not the dedup*.

**Because the cap is what bounds the pathological peer.** Somebody present
on all hundred partners:

```
uncapped   100 rows   46 KB     for one peer
cap of 2     1 row    ~0.5 KB   97x
```

Without a cap, the cost of a *popular* peer grows with your partner count,
and popularity is exactly what a network produces. With one, it does not
grow at all.

**So the memory stops depending on the number of partnerships** and starts
depending on the number of distinct people reachable — which is a property
of the network rather than of the owner's enthusiasm. That is the
flattening, and it is worth more than any of the shedding policy above:
shedding reacts to pressure, this removes the source of it.

**Two routes, not one**, because one is a single point of failure: the day
that partner's stream closes, every peer reachable only through it becomes
unreachable, and you have paid for a route table that evaporates. Two is
redundancy; fifty is hoarding. Configurable, defaulting low.

### A partnership is not a contract

It is **two unilateral decisions that happen to agree.** Reciprocity is a
precondition for the thing being *useful*, not a promise either side made.
So there is no cancellation protocol to design, no negotiation and no
teardown handshake: A stops holding B's list and stops forwarding, and B
finds out the next time a forward is refused.

That is worth stating because the alternative — a contract — would need an
agreement to end it, and a relay under memory pressure cannot wait for the
other side to answer.

### Dropping the list is not ending the partnership

The cheapest useful insight here. The **flag** costs one boolean on a row
the relay already keeps. The **hint list** costs `members × ~460 B`. Those
are five orders of magnitude apart and should be shed separately:

| state | holds | routes to that partner |
|---|---|---|
| healthy | flag + hint list | immediately, from memory |
| under pressure | **flag only** | on demand — ask the partner's public census when a packet actually needs it |
| cancelled | nothing | refuses, as before the partnership |

So **memory pressure degrades performance, not connectivity.** A relay that
sheds every hint list it holds still routes everywhere it did; it is just
slower and chattier while it does. Nothing anybody depends on breaks, which
is the property that makes automatic shedding safe enough to do without
asking the owner.

### The budget is in rows, not partners

Three partners of ten thousand members cost more than fifty of ten. The
table above is exactly why: what a relay must cap is the number of **rows
held**, and partner count is not a proxy for it.

### The algorithm, and it is a division

One counter per partner — **forwards carried since boot**, an integer in
RAM, reset on restart. Counting its own work is not storing on anyone's
behalf, so 0006 is untouched.

```
value  =  forwards carried for this partner
cost   =  rows held for this partner
rank   =  value / cost
```

- **Over budget:** shed the hint list of the lowest rank. Keep the flag.
- **Admitting a new partner:** it has no history, so give it the list on
  trust while there is room; when there is not, compare its *cost* against
  the worst incumbent's rank and decline if it cannot be afforded.
- **Cancel** only on owner input, or on a partner that has been rank-zero
  and listless for long enough that the flag is a fiction.

Rank-zero-and-shed is the honest steady state for a partner nobody talks
to: it costs one boolean, and the day somebody does talk to them it works,
slowly, and starts earning a list back.

**Why not something cleverer:** every richer signal — latency, uptime,
reciprocal traffic, refusal rates — needs history a relay does not keep and
0006 discourages it from keeping. One counter and one division use only
what the relay can see about its own work, which is the same constraint
that produced every other good decision in this tree.

**Route usage is the generalisation of that counter**, and the thing to
reach for if one division proves too blunt:

> **Andy:** "somehow measure route-usage in memory to real-time optimize."

`routes` — posts registered and not yet answered — is already reported by
`relayStatus`, and it is already the one figure that says whether a relay is
*busy* rather than merely *populated*. A per-partner version of it is the
same idea at the granularity the policy needs, and **in memory** is the
whole point: it resets on restart, it is never served, and it describes the
relay's own work rather than anybody's traffic. A counter that survived a
reboot would be a record of who talks to whom, which is precisely what this
system does not keep.

### The node has the same problem upside down

> **Andy:** "one concept for optimization is: culling too many redundant
> relays for one peer id. the node wants the highest number of peers
> accessible."

A relay culls **partners** to protect memory it spends on other people. A
node culls **relays** to stop paying for reach it already has. Same shape,
opposite direction, and the node's objective is the one that matters to a
person: *how many peers can I reach*, not *how many relays am I on*.

Once partners exist, a relay's reach is bigger than its roster:

```
reachable(R)  =  members(R)  ∪  members of R's partners
```

So a second relay is only worth holding if it reaches somebody the first
cannot:

```
unique(R)  =  reachable(R)  minus  reachable(everything else I hold)
cull R     when  unique(R) is empty
```

**A relay with no unique reach costs a claim, a binding, a pinned key and a
held stream, and buys nothing.** That is the redundancy worth culling —
not "too many relays" by count, which would be the wrong measure for the
same reason partner-count was.

**It needs no new wire either.** `ownerBadge.probe` already fetches every
configured relay's census on every probe; the unions and the subtraction
are arithmetic on data already in hand.

**And the rule already exists in embryo.** `canRemoveRelay` refuses to
leave a node with no *public* relay — a floor. This is the same family with
a ceiling: keep every relay that reaches somebody new, drop the ones that
do not, and never drop the last one that can carry anything.

The two policies are worth stating together because they pull opposite
ways and that is healthy: a relay wants **fewer, better** partners; a node
wants **enough, distinct** relays. Neither is authoritative over the other,
and a node that finds itself culled from a relay simply discovers it the
next time it probes.

### What a relay must not do

**Shed on somebody else's schedule.** Eviction is the relay's own decision
about its own memory. A partner cannot cause it, and a packet must never be
able to — otherwise "make A drop B" is one flood away, and the survival
mechanism becomes the attack.

---

## The problem it solves

A relay delivers **between its own members and nobody else**. Two nodes on
two relays cannot reach each other at all:

```
routePost:  sender has no row here  → 403 "no such identity"
            target has no row here  → 404 "no such peer"
```

So a second public relay — `lab.andyflinn.com`, standing up the same day —
is a second island. Everything per-relay can be tested against it
(bindings, pinning, labels, the auto-add policy, owning one while being a
member of another) but a packet cannot cross.

---

## What is already true, and it is most of the mechanism

| fact | where |
|---|---|
| `GET /api/relay/who` is **public and unsigned** — 0010 calls it "what a node reads *before* it has anything" | `decisions/0010` |
| every census row carries `publicKey` and `owner` | `relay.who()` |
| so **"this peer owns a relay over there" is checkable against public data**, by key, with no new wire | — |
| a peer row already carries a boolean status (`owner: true`) — `partner: true` is the same shape in the same store | `relay.js` |
| relays already have keys of their own, and nodes already pin them | `relayKeys.json`, `ownerBadge` |
| **the hash survives a hop for free** — 0011 made it a function of bytes, computed at every party and carried by none, so a forwarded packet correlates end to end unchanged | `decisions/0011` |

That last one was not designed for this and pays off anyway, which is
usually the sign the decision was right.

### And one that is not true

**`relay.js` makes no outbound request of any kind.** No `fetch`, no
`http.request`. It is purely a server; every outbound call in this system
is made by a *node*. A relay that fetches a URL is a relay with an SSRF
surface, a timeout budget and a retry policy, on a box whose whole design
is to do less.

This is the real threshold in the proposal — bigger than the flag.

---

## Decided (Andy)

1. **A relay may promote a peer to `partner` in its own peer ledger.** Not
   a new store: a flag on the row, beside `owner`.
2. **Reciprocity is the test.** A partner is a non-owner peer here who owns
   a relay elsewhere, and both sides establish that fact through owner
   input. Neither relay takes the other's word for it.
3. **One level. No transitivity.** B's partners are not A's partners — for
   the trust reason above *and* because `partners² × members` does not fit
   on the box.
4. **A referral is only acceptable if it is verifiable** by the party
   relying on it, against public data, by key.
5. **A relay may decline or cancel a partnership to survive**, and choose
   its partners by an algorithm that is smart rather than complicated.
6. **A relay NEVER persists a partner's ledger.** Hard rule. It is useless
   for an offline partner and askable for a live one, so it has no case.
   `partner` on a peer row persists; the *list* has nowhere on disk to be.
7. **What is held is ONE route table keyed by peer, with routes capped**
   (two by default). Not a list per partner. The cap is what stops a
   popular peer costing one row per partnership.

## Recommended (Claude), not yet decided

8. **The node fetches; the relay stores the conclusion.** The owner's node
   already fetches censuses per relay (`ownerBadge.probe`). Let it do the
   reciprocity check and post the result. The relay keeps `partner: true`
   and never learns how to reach out.
9. **One hop, full stop.** A forwarded post is never forwarded again. With
   two relays there is no loop to prevent; the rule has to be written while
   that is still true, and it makes (3) enforceable rather than merely
   intended.
10. **The route table is a HINT, never an authority.** B checks its
   own ledger when a forward lands, as it does for any post. A stale hint
   then costs a wasted hop and a refusal — never a wrong delivery.
11. **Bind lifetime to presence, not a TTL.** Add a partner's routes when
   their owner opens a stream here; remove them when it closes, and evict
   any peer left with no route. Follows from decision (6).

### Withdrawn

- ~~Write the 0006 carve-out in the same breath as the flag.~~ It was
  solving a problem decision (6) deletes: nothing is stored on anyone's
  behalf because nothing is stored. **0006 stands untouched**, which is a
  better outcome than an exception to it.

## Open

- **What a partner may do, beyond carrying one hop.** Start with the
  cheapest useful allowance and add deliberately. "Partner exists" is worth
  having before "partner may".
- **Is `partner: true` public in the census?** It is a public statement of
  association between two relays. Probably fine, possibly useful, not
  obviously either.
- **How the hint list is obtained and refreshed.** On demand per question is
  simplest and always correct; a RAM copy with a TTL is the optimisation.
  At ten peers neither is measurable — and the table above says when it
  stops being free, which is later than it feels.
- **A stale flag is nobody's emergency.** Nothing re-checks that a peer
  still owns the relay it was partnered for. Left open deliberately:

  > **Andy:** "I'm not too concerned about the flags, later on the relay
  > can report to its owner things like partner x unavailable for n
  > hours/days etc."

  Which is the right shape — an owner-event about a partnership that has
  gone quiet, not a re-verification loop. A relay already knows when a
  partner's owner was last present, and that is the number worth
  reporting. Tier two has to handle a refused forward regardless, so a
  stale flag costs a wasted hop and a line in the log.
- **What B answers when it refuses a forward.** A's caller learns *what*,
  and A learns something about its hint. Both are log entries nobody has
  specified.

---

## The delivery path, if all of the above lands

```
N1 ──post──▶ A ──forward (signed as A) ──▶ B ──deliver──▶ N2
```

- N1 signs the post; A verifies against N1's row on A.
- A signs the *forward* with its own relay key; B verifies against the
  partner key it pinned at promotion.
- **N1 never gains a row on B.** B relays the bytes and stores nothing —
  which is what keeps 0006 intact on the delivery half.
- All four parties compute the same hash over the same bytes, and none of
  them carries it.

---

## Build order, when it is time

The flag first, because until the hint list exists A simply refuses and
nothing is broken — it is just not routing yet.

1. `partner` on the peer row, promoted by an owner verb, with the
   reciprocity check performed node-side
2. the partner's relay key pinned at promotion
3. one-hop forward, with no-transitivity enforced rather than documented
4. the hint list — last, and smallest

Each step is useful alone, and the first three change nothing about what a
relay stores.
