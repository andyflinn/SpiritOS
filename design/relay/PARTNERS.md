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

### A relay NEVER persists a partner's members

> **Andy:** "the relay must NEVER persist a partner's ledger. that's a
> hard rule. It is of no use anyway if the partner is not online and
> alive."

*Heading corrected 2026-09-16: "ledger" was ambiguous once a partnership
became a stored thing in its own right. What may never be written down is
a partner's **members**. The partnership itself persists — that is item 1.*

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
  *list* has nowhere on disk to be.

**Where the partnership itself lives — corrected 2026-09-16.** This said
the `partner` flag rides a peer row. Two things broke that, both from
Andy:

*"our relay-owning peers may also own multiple relays, so in our
partner-records partner-relay-IDs must be unique, and the owner of those
relays must not be unique."* — a field on a peer row holds one
partnership, and one owner may have twenty relays.

*"i might ban a peer, but still want his relays to help mine."* — decisive,
and it ends the case for nesting. Banning is about **membership**;
partnership is between **relays**. Cutting one must not cut the other, or
banning one person disconnects everyone their relay serves.

So reciprocity is a check at **promotion time**, not a standing condition —
which the code already assumed: the forward path authenticates against the
**pinned relay key**, never against a peer row. The owner's row was the
evidence, never the substance.

```
relay-state/partners.json
  "<relayKey>": { url, ownerKey, since,
                  carried, refused, lastUsed,
                  peersSeen, peersPrev, peersSeenAt }
```

Keyed by relay key — unique, O(1) for the forward path's one hot
question (*is this signer a partner?*), many per owner for free.
`ownerKey` is recorded for re-verification and display, not as the key.

**The stats are running values, never history.** Nine fields, fixed,
updated in place; nothing per peer, nothing appended. That reverses the
RAM-only counter below, and for a reason that section missed: a counter
reset on restart means a relay that reboots nightly can never learn
anything about a partner — every morning every partner is rank-zero and
indistinguishable, so the algorithm meant to shed the worst has nothing to
shed by. Coarseness is the protection, not volatility: counts and a day,
never an event log, never a peer.

**Nothing cleans it up automatically any more.** That was nesting's one
real advantage — `delete peers[key]` took the partnership with it — and it
is traded deliberately. `forgetPeer` must therefore *say* that a banned
peer's relay is still partnered, or banning looks complete and is not.

### And the lifetime is already measured — it is presence

> **Superseded 2026-09-16 by tier two.** The mechanism below binds the
> route table to the **owner's** presence, as a proxy for whether their
> relay is worth routing to. That inverts for a fleet — the relays run
> permanently, the owner's laptop does not — and it was never needed:
> B filters to present members at the source, so the bound below arrives
> by filtering instead. Kept because the *bound* it identifies is right
> and is the one tier two delivers.

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

> **Superseded 2026-09-16.** The counter is persistent now, in
> `partners.json` above — not history, a running value updated in place.
> The flaw this paragraph missed is that *reset on restart* means nothing
> is ever learned: a relay that reboots nightly wakes with every partner
> rank-zero and no way to tell a dead one from a new one. The rule that
> replaces "don't keep it" is **count the relationship, never the
> members** — and a lifetime total needs `lastUsed` beside it, or a
> partner that was busy last year outranks one doing work today.

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

> **Terminology, and this list has to hold it exactly** — in code as well
> as here (`DICTIONARY.md`).
>
> **Nodes have peers. Relays have partners.**
>
> | word | belongs to | is |
> |---|---|---|
> | **peer** | a node | another person's box |
> | **partner** | a relay | another **relay**, pinned by relay key |
> | **member** | a relay | an enrolled row — who claimed a name here |
>
> A relay has no peers. Saying "peer" inside a relay structure is how
> *"promote a peer to partner"* survived in item 1 for a week, and how the
> route table below nearly shipped keyed by the wrong noun.
>
> The one place the tree still disagrees: `routingTable.json` names its
> enrolment map `peers`, and the public census answers `{"peers": [...]}`.
> Those are **members**. Recorded rather than renamed — it is on the wire
> and in a persisted shape — but nothing *new* may take the word.

1. **A relay may promote another RELAY to `partner` in its own PARTNER
   ledger. A NEW store** — `relay-state/partners.json`, keyed by the
   partner's relay key.

   **This said "promote a peer … in its own peer ledger. Not a new store:
   a flag on the row" — corrected 2026-09-16.** A flag on a peer row holds
   one partnership per owner, and an owner may run twenty relays; and
   *"i might ban a peer, but still want his relays to help mine"* means a
   partnership has to outlive a membership it was never made of. The thing
   being promoted is a **relay**, identified by its relay key. See
   §"A relay NEVER persists a partner's ledger" for the shape and for what
   the new store costs.

2. **Reciprocity is the test, and it is tested once.** At promotion, the
   far relay's public census must show that key marked owner — both sides
   establish it through owner input, and neither takes the other's word.
   Afterwards the partnership stands on the **pinned relay key**, which is
   what the forward path has always authenticated against.

   **This said "a NON-OWNER peer here", and that was corrected on
   2026-09-16.** Andy: *"the relays need to be different, the owners?
   why?"* — and there was no answer. "Not the owner" was shorthand for
   "not this box", written while one key owned one relay, where the two
   sentences are the same. Own twenty and your key is `owner: true` on
   all twenty while the machines are genuinely different, so the rule
   refused the thing it was never about.

   The invariant is **a relay is not its own partner**, and it is now
   tested as such: the partner's relay key against this relay's own
   (`relay.js`, `setPartner`). That is *stricter* — the old check would
   have let any non-owner peer partner this box with itself by naming its
   own url.

   Nothing in (4) weakens. With one owner the census proves *"one key
   owns both"*, which is true, public and checkable by key; and no third
   party's consent is bypassed, because partnering only creates routes
   between the two relays' own members and the other relay's owner must
   promote this one in turn.
3. **One level. No transitivity.** B's partners are not A's partners — for
   the trust reason above *and* because `partners² × members` does not fit
   on the box.
4. **A referral is only acceptable if it is verifiable** by the party
   relying on it, against public data, by key.
5. **A relay may decline or cancel a partnership to survive**, and choose
   its partners by an algorithm that is smart rather than complicated.
6. **A relay NEVER persists a partner's members.** Hard rule. That list is
   useless for an offline partner and askable for a live one, so it has no
   case. The **partnership** persists — `partners.json`, item 1 — and what
   has nowhere on disk to be is who that partner carries.
7. **What is held is ONE route table keyed by identity, whose routes are
   PARTNERS, capped** (two by default). Not a list per partner. The cap is
   what stops one popular identity costing a row per partnership.

   ```
   route table (RAM)    <identity key>  ->  [ partnerRelayKey, partnerRelayKey ]
   ```

   The key is an identity — a box somewhere that this relay does not hold
   a row for. The **value is a partner**, which is the only kind of
   counterpart a relay has.

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
11. ~~**Bind lifetime to presence, not a TTL.** Add a partner's routes when
   their owner opens a stream here; remove them when it closes.~~
   **Withdrawn 2026-09-16.** It used the *owner's* presence as a proxy for
   whether their relay was worth routing to — fine for a stranger, and
   inverted for a fleet, where the relays run permanently and the owner's
   laptop does not. Tier two replaces it: B filters to present peers at
   the source, so the bound arrives by filtering rather than by a lifetime
   rule, and nothing depends on a person being awake.

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

## Tier two — the partner stream (decided 2026-09-16)

**Partners hold streams to each other.** One each way.

The case against was that a stream is a session, and this design has no
inter-relay sessions. Andy ended it:

> *"partners are the most permanent presences in practice: they are
> designed to run indefinitely, browsers are not… the streams will never
> be held, they only get presence and fan it immediately, no storage no
> logs, nothing."*

Backwards, in other words: a relay is the *stablest* party in the system,
and the box already supervises a flapping stream per member on sleeping
laptops. Nineteen streams to machines that never sleep is the easy case.

### Same protocol, and the direction is not the node's

> **Andy:** "request by post, reply by stream. in both directions."

```
A ─POST /api/relay/post  (forward, co-signed by A)──▶ B
A ◀─ reply, down the stream A holds with B ────────── B
```

A node receives `request` down its stream **only because a browser cannot
be POSTed to**. Two relays are both publicly reachable, so the request leg
is a POST both ways and the stream is purely the return path. Same
`request`/`reply` vocabulary, same hash matched independently at each hop,
same receipt signature.

### Two registries, not one stream with a flag

`presence.js` is already `createRegistry(opts)` with its own `sinks` per
instance, so this is two instances and no new code:

```js
var presentNow  = presence.createRegistry({…});   // members
var partnersNow = presence.createRegistry({…});   // partner relays
```

A partner must never enter `presentNow`: opening a member stream runs
`broadcast('presence', {key, present:true})` and `send(id,'roster',…)`, so
a relay arriving there would be announced to every member as a present
peer, rostered, counted, and addressable as a post target — a box in the
attendance list as a person.

Separate maps make that structural rather than remembered. At B, a
forwarded request's `requester` is **A**, so `routeReply` finds A's sink in
`partnersNow` — a lookup across two maps, not a flag on a record.

| | member's stream | partner's stream |
|---|---|---|
| `request` | yes — no other way to reach a node | no — it arrives as a POST |
| `reply` | yes | yes |
| `presence`, `roster` | yes | yes |
| `owner-event`, `relay-status` | owner only | never |

### Opening one

`streamOpen` today needs a **member** row. A partner has none and must not be
given one — that would mean invites minted for boxes and relays in the
census pretending to be people. **The pinned partner key is the
authorization**: same route shape, same `streamSignatureOk`, one more
identity source. Breaking the partnership closes the stream, because the
key that authorized it is no longer pinned.

### Relay-to-relay is an authenticated exchange, and needs no new handshake

> **Andy:** "a good enough handshake and proof information can be
> exchanged, the relays use a protocol-post to get info?"

**The handshake already happened.** Promotion verified reciprocity against
the far public census and pinned that relay's key. The pin *is* the proof;
there is nothing further to exchange before two relays can talk.

So a relay asking a partner anything is a **post signed with its own relay
key, verified against the pinned partner record** — the same admission
path the forward needs. One mechanism, two kinds of request:

```
A ─POST (signed as A) → B    "forward this"       the delivery leg
A ─POST (signed as A) → B    "who is present?"    the same door
```

**Which is why presence stays OFF the public census.** Partners get it
because they are authenticated; a stranger reading `/api/relay/who` still
gets enrolment and nothing else. That also puts the filter where it can
work: B is answering a known party, so B can decide what to send —
present-only, capped, priced per partner. A public GET cannot, because it
does not know who is asking.

> **Withdrawn with it:** adding `present:` to census rows. It was the
> cheap way to let a partner filter, and it published per-person
> attendance to the whole internet to solve a problem between two
> authenticated boxes. The census stays enrolment, and stays stable.

### Replies are matched. Events are not.

> **Andy:** "same as a node talking to a relay."

A reply carries a hash and finds A's pending entry. An event answers
nothing and matches nothing — it is addressed to the stream, exactly like
`presence` on a member's. That is what turns one answer into a
subscription: the POST asks *and* says what to keep sending.

| | matched by | |
|---|---|---|
| `reply` | hash, against the requester's pending entry | answers a POST |
| `presence`, `roster` | nothing | the far side volunteering a change |

So the whole of it is: **request by POST, reply by stream, events by
stream, admitted by the pin.** A partner is a node-shaped party that is
let in by a key instead of a row — which is why none of this needed a
protocol of its own.

### POST is the control channel

> **Andy:** "post only are there to start the stream, or filter it at the
> source, like dont gimme offline peers, they don't help me."

**Online only, filtered at B.** B sends A only **members** who are present, and
`present:false` when one leaves. A never holds a row it could not use, and
a partner with 10,000 enrolled and 200 online costs 200 rows. That is the
member-lists × member-lists exponent flattened by filtering rather than by a
lifetime rule — and it delivers the bound §"the lifetime is already
measured" wanted, without the presence-of-owner proxy that turned out to be
wrong.

**The recipient de-dupes.** The route cap stays local to A:

> **Andy:** "yes. the recipient de-dupes."

A is the only party that knows how many routes it already holds for a key.
Asking B to exclude them would hand B a map of who A reaches through other
partners — the same reason a search hit must not say *via whom*. A drops
the surplus on arrival; B never learns why.

| decided by | | why |
|---|---|---|
| **B** (source) | online only | only B knows, and it saves the bytes |
| **A** (local) | route cap, de-dup | only A knows, and it is A's topology |

### Presence, and why it gates nothing

> **Andy:** "don't gate on presence, absolutely. but a best effort in
> displaying presence indicator in real time is sexy and useful."

Every dot is a false positive sometimes — a peer can drop the instant
after the broadcast — so presence is a **hint**, exactly as the route table
is. The far end is authoritative: it delivers or refuses instantly (0006).

Which means nothing waits on a dot. Refusing a chat input because a mark is
red lets a stale mark silently remove a working feature, and the stale mark
is guaranteed. Post, and let the refusal be the answer.

`contacts.js` already models it correctly and stricter than proposed here —
green / red / **white**, where white is *unseen* rather than dim red, and
*"anything unknown, stale or unreachable reads as white — the mark that
promises nothing."* An identity reachable only through a partner, with
nothing known about it, is white — which is
honest. Traffic is the cheapest refresh there is: a successful post proves
presence at that instant, a refusal proves absence, and both are free.

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
