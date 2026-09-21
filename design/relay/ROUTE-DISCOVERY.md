# Collaborative route discovery, on demand

**Designed 2026-09-17. Nothing built.** Every claim about the tree was checked at
`1edc4fe`.

> **Andy:** *"so this collaborative route caching on demand is a key component
> that must be designed."*
>
> *"It's as fundamental as proper tunnelling, with a higher cost impact."*

Higher, because the tunnel decides whether **a** packet can cross while this
decides what **every** discovery costs, for as long as the network runs — and
whether `streamRoster` can be retired.

---

## The gap it fills

A node can find a peer across a partnership (`search`, built) and acquire them
as a contact (built, proven live both directions on 2026-09-17). It cannot post
to them.

[0012](../decisions/0012-a-relay-never-asks-for-a-member-list.md) said where the
answer comes from — *"which partner comes from the node, which already has it: a
search row carries the partner's URL"* — and that turned out to assume a hint
**the wire does not carry**. A post is `from`, `to`, `text`, `sig`. There is no
field for where the target lives, so the relay has nothing to route on.

The first implementation guessed, by posting the member's packet to every
partner and letting the wrong ones refuse it. Andy killed it on three counts,
and the third is the one that matters here:

> *"and you burn your quota on all partners in parallel"*

Each of those posts spends a unit in a **different** relay's partner pool, so
nineteen partners cost nineteen units per forward — `partners × members`
returning as traffic after 0012 deleted it as memory. Forwarding now goes to one
named partner or nowhere, and **nothing on the wire can name one**, so it is
inert. This document is what names it.

---

## Most routes are already free, and already taken

Found while writing this, and it narrows what the mechanism is actually for.

> **Andy:** *"there are a few relay interfaces that give routes for free."*

| interface | the route it gives | harvested today? |
|---|---|---|
| **the census** — `/api/relay/who`, read on every probe | every member of every relay this node is bound to | **yes.** `hub.buildPeople` → `whoBook.handshake({… relay: relayUrl })` |
| **an arriving message** | the sender is bound to the relay it came through | **yes.** `hub.remember(…, relayUrl)` → `acquire` with `relay` |
| **search** | which partners hold them — `via`, and now `vias` for all of them | **yes** |
| **the roster and the presence stream** | every member of a relay this node holds a stream to | **in RAM only** — `presenceNode.byRelay[url][key]`, never written to the book |

So a node already learns, free and continuously, the route of **everyone on
every relay it is bound to**. That was never the gap.

**The gap is partner routes**, and `search` already fills it for anyone found by
searching. Which changes what this document's mechanism is for: **not initial
discovery, but refresh** — a route that went stale — **and presence at scale**,
which is the roster's replacement. A smaller job with a different justification,
and worth knowing before anybody builds the big version of it.

### And the census is bootstrap scaffolding that became load-bearing

> **Andy:** *"the most fetched because it bootstrapped concepts quickly, but is
> not scalable."*

`GET /api/relay/who` is the most-fetched interface in the system — **nine call
sites** — and it is the largest ship-the-material payload in it:

```
census row  151 bytes  →  1 000 members = 147 KB per fetch
roster row  101 bytes  →  1 000 members =  99 KB per connect
```

It is not on a timer, which is what has kept it survivable: probes fire on user
actions, at presence start, at acquire, at handle-candidates. Human-paced, and
fetched **whole**, **repeatedly**, **per relay**.

**It is not a design. It is the thing that was easiest to reach for while the
concepts were being proven**, and the call sites accreted around it. So the
useful question is not *"how do we shrink the census"* but **what is each caller
actually asking**, because most of them want something far narrower:

| caller | the question it is really asking | cheaper form |
|---|---|---|
| `ownerBadge.probe` | *am I on this relay, and how is it?* | own row + status |
| `buildPeople` | *labels and routes for people I know* | `about([my keys])` |
| `peer.acquire` verification | *is key K on relay R?* | **migrated 2026-09-17** — `?key=` at the same door: 146 KB → 256 bytes at a thousand members |
| `handleHandle` / candidates | *who claims the handle "john"?* | `search` — which already exists |
| `device.html` | *what label belongs to key K?* | a per-key label lookup |
| `handleRoster` | *who is on this relay?* | the only one that genuinely wants a list |

**`peer.acquire` is the sharpest waste:** it pulls up to 147 KB to answer yes or
no about **one key**.

**One constraint stops it disappearing.** The census is *public and unsigned* —
decision 0010 calls it *"what a node reads before it has anything"*. `device.html`
resolves a label with no identity at all, and acquire verifies keys on relays the
node is **not a member of**. An authenticated per-key question cannot serve a
party that has no relationship yet.

So the shape of its retirement is probably **members ask questions; strangers
still get a census** — and the open question becomes whether the public census
can be bounded (paged, capped, or answered by prefix) without breaking the
bootstrap it exists for.

### A finding: binding and presence are conflated at the lookup

```js
relaysNaming: function (key) {
  return Object.keys(byRelay).filter(function (url) {
    return byRelay[url][key] === true;     // present, not merely bound
  });
}
```

`byRelay` holds **binding** — the roster lists every member, present or absent,
which is the whole reason the roster carries states (*"if this sent only who is
here, a key a node did not hear about would be ambiguous"*). `relaysNaming`
then returns only the entries whose value is `true`, i.e. **present**.

That is right for *"can I deliver right now"* and wrong for *"where is this peer
bound"*, and the node has no other way to ask the second question. **A contact
who is merely asleep is indistinguishable from one with no known route.**

It is the same shape as the bug in the merger: information gathered, held, and
discarded at the last step by a filter that answers a narrower question than the
caller asked. It is also why jazz's failure read *"that peer is not reachable
right now"* for a case that is really *"not bound here at all"* — one of those is
worth waiting out and the other never will be.

## The shape

```
node ──▶ each relay it is bound to
         { about: [ key, … ] , tuples: [ {key, relayKey}, … ] }

relay:   mine?                    → answer locally. No fan-out.
         tuple names my partner?  → keep it. No fan-out.
         otherwise                → THAT REMAINDER goes to partners

relay ──▶ node
         relayTable: [ relayKey, … ]          once
         per key: which table entries hold it, and whether present
```

Four rules give it its shape, and each is Andy's:

**1. Only through relays you are bound to.**

> *"The mechanism for finding ANY route to any peer must go through relays I'm
> bound to."*

A node never speaks to a partner. It has no relationship with one and no reason
to want one. **Reach expands; relationships do not** — which is what keeps *one
protocol, spoken between two identities that have pinned each other's keys*
true as the mesh grows.

**2. The called relay does not fan out its own members.** It answers those
locally; only what it cannot resolve costs a partner anything. This is also why
the node needs no roster to filter with — the relay knows its membership
authoritatively, and the node's copy was the thing that did not scale.

**3. The node sends the tuples it already holds**, so the relay can skip the
fan-out for keys already routed, and **cull** tuples naming relays it does not
partner with — useless to it, so they never cost a post.

It does **not verify** them. A stale tuple is cheaper to *use* and let the
forward fail than to check: a verification is a round trip, and the failure is
free and arrives only when it matters. **The failure is the verification.**

**4. Bulk and prioritised, because none of it is free.**

> **Andy:** *"it costs budget, that's why we do it in bulk, prioritized."*

| step | paid by | in |
|---|---|---|
| the ask | the member | one post from its member-pool allowance |
| local resolution | the relay | CPU, `keys × lookups` |
| the remainder | the relay | one post into **each** partner's pool |

So: one post per batch, in recency order. `traffic.jsonl` already carries `at`
and `peer`, so recency is a local read of the node's own record — and the log's
retention window conveniently **is** the priority window: a contact with no
entry is by definition not one you need routed first.

---

## Why "collaborative" is the right word

Neither end has the answer alone, and both end up holding it:

- **The node** knows who it wants to reach and keeps the result durably
  (`whoBook.relays` is already the field, written at acquire time).
- **The relay** knows its own membership and its partners, and is the only party
  that can ask them.
- **The node re-primes the relay.** A relay that reboots has forgotten every
  route; its members hand them back on the next request. That is why the relay
  need never persist any of it, and why
  [0013](../decisions/0013-a-relay-is-fixed-cost-per-time-unit.md) can say the
  network's durable memory lives in nodes.

**Everything expensive happens once; everything repeated is one post.** That is
the same logic as the meter, and it is what makes a fixed-cost relay survive a
growing mesh.

---

## The reply is by reference, and the cap is the relay's

A key is ~44 characters; a `{key, relayKey}` tuple is ~90 bytes; `PAYLOAD_MAX`
is 16384. A peer may be bound to several relays, so the worst case is
`keys × partners`:

```
by value:      K × P × 90 ≤ 16384   →  at P = 19, K ≤ 9 keys per call
by reference:  table P × 44 ≈ 840 B, then ~47 B per key
                                     →  at P = 19, K ≈ 330
```

**Nine versus three hundred and thirty**, for the same information. The relay
table travels once and each key carries indices or a bitmask into it — which is
`PARTNERS.md`'s tier-three rule (*"not a URL per row: a small index per row into
a relay table sent once per reply"*) applied to a second use.

A bitmask also makes **multiple routes per key free** — three bytes covers
nineteen partners — so the resilience Andy asked for (*"the request envelope can
contain multiple routing options"*) costs nothing per extra route.

**The cap belongs to the answering relay**, because only it knows its own
partner count, and the node should not have to. Same shape as the rate limit:
derived from what it can see, and **named in the refusal** — *"at most 330 keys,
you sent 500"*.

---

## What the relay does with a route it just discovered

> **Andy:** *"crazy question: what would happen if the relay, upon discovering
> routes, streams every found route to all its members, and members can filter
> out the useful ones?"*
>
> *"What is the cost to the member — a little bandwidth, already paid for?
> Compare that to four family members watching different YouTube streams."*
>
> *"And processor speed and bandwidth are cheap with VPS."*

**Broadcast and forget, not hold and answer.** The instinct behind the question
is the one the design was missing: a discovery is expensive and should be paid
for **once for the whole relay**, not once per member who wants the same peer.

The author first argued against it on `M × discoveries` grounds. That was scale
theatre, and the numbers say so:

```
one route event ≈ 90 bytes
a member receives   1 000 discoveries/day  →   90 KB/day
                   10 000 discoveries/day  →  900 KB/day
a relay sends      1 000 members × 1 000   →   90 MB/day egress
```

90 KB a day is four seconds of one video stream. And `M` cannot run away,
because RAM bounds it long before bandwidth does — `PARTNERS.md`'s own table puts
a 1 GB box in the low thousands of members.

**The decisive argument is not the traffic, it is what the relay stops holding.**

| | the relay holds | traffic |
|---|---|---|
| hold and answer | a working set of foreign keys, needing a size cap, an expiry rule, and an amendment to 0012 | `O(1)` |
| **broadcast and forget** | **nothing** | `M` per discovery |

Broadcasting is **cheaper in the expensive resource**. It needs no working set,
no lifetime policy, no re-priming after a reboot — every member already has what
it learned — and it is the purest reading of *"externalize as much cost as
possible"*: the owner externalizes the **memory entirely** and keeps only the
wire. Under 0013's ranking (*spend CPU and bandwidth freely to protect RAM*)
that is not a close call.

It also compares well with the defect already in the tree: the roster costs
`M × connects`, and laptops flap, while this costs `M × discoveries`, and
discoveries are rare. **The expensive one is the thing already running.**

**What broadcasting costs, recorded rather than waved away:**

- **Timing leaks interest.** The route itself is public — the named relay's
  census says so to anyone — but *"a route for sonny appeared just now"* tells
  everyone on the relay that somebody here went looking. The cache does not leak
  this. It is the one real advantage the rejected option had.
- **Members receive routes they will never use.** True, and at 90 KB/day it does
  not matter.

**Which makes the relay stateless about routes**, and the mechanism above
simplifies: the relay resolves, announces, and forgets. The tuples a node sends
with its request are then the *only* memory in the system, which is 0013's
architecture with nothing left over.

## A streamed route is not correspondence

> **Andy:** *"I think that streamed routes should be exempt from the log — they
> just miraculously get stashed on the correct contact-row."*

**Not logged, and there is already precedent: presence writes nothing to the
traffic log either.** Andy, confirming what the log is: *"the log is mainly for
request/reply."* Correspondence — what this node asked and what it answered.
Routing metadata is not that. A route arrives the way a presence change arrives — a
stream event, handled beside `onRoster` and `onChange`, never through
`peerPost`'s `note()`.

Three reasons, and the third is the one worth not missing:

1. **It is not correspondence.** `trafficLog.js` is *"what this node sent and
   what it received"*. A route announcement is neither; nobody addressed it to
   you.
2. **Volume would accumulate for ever.** Andy: *"the log is forever."* There
   was a 24-hour window and it is gone — `trafficLog.js`: *"nothing is pruned on
   the way out any more, because nothing is pruned at all"*, because *"the log
   should be permanent. period."* So route noise would not evict real traffic;
   it would **grow the owner's disk without bound, permanently**, with
   infrastructure chatter nobody will ever read.
3. **It would distribute the one thing broadcasting leaks, for ever.**
   Announcing routes leaks timing: *"a route for sonny appeared just now"* says
   somebody here went looking. Logging it turns a transient leak into a
   **permanent record, on every member's node, of everything a relay's members
   have ever looked up** — worse than the relay holding it, because the relay
   forgets on reboot and a permanent log does not.

### Stashed, with one boundary

**Match an existing contact row and update `whoBook.relays`. Never create a
row.**

A route announcement must be able to improve a contact you already have, and
must **not** be able to put a person into your book — otherwise a relay can
inject contacts, and *"my book is mine"* stops being true. A route for a key
with no row is dropped, which is also the filter that makes broadcasting cheap
for the recipient: most announcements are about people you do not know, and
those cost one comparison and nothing else.

Together with the sidecar boundary above, the rule is symmetrical:

> **A relay may improve what a node knows about its own contacts. It may never
> add to them, and a node may never make a claim that a relay repeats.**

## What it retires

- **`streamRoster`'s full member list.** Its only job is the three-state dot:
  the full list is what distinguishes *"member, away"* from *"never heard of
  them"*. The same call answers that per key — **bound + present** green,
  **bound + absent** red, **not bound anywhere** white — and scales with the
  asker's book rather than the relay's membership. Measured today: 101 bytes a
  row, 19 KB past `PAYLOAD_MAX` at 190 members, 99 KB at a thousand, pushed on
  every connect.
- **The broadcast forward**, which this replaces with a named target.
- **The hint list's ghost.** 0012 deleted the bulk fetch; this supplies the
  same knowledge one demanded key at a time, which is the difference between a
  roster and an answer.

---

## Route sidecars — explored, not decided

> **Andy:** *"worth exploring? route-sidecars to requests, bundled by the
> node… this would help the as-needed concept."*

**The shape:** a node attaches to posts it is already sending a small sidecar of
*"keys I still lack routes for"* and *"tuples I already hold"*. The relay
answers on the reply that was coming back anyway. Discovery stops being a call
and becomes metadata on traffic that already flows.

### Why it matters more than the bytes it saves

**"As needed" is only sustainable if needing is cheap.** Without a sidecar,
on-demand means: want to post → find no route → spend a post asking → wait →
post. Two round trips and two budget units before every first contact, every
time. That pressure is exactly what pushes a designer toward pre-fetching at
connect — the anticipatory bulk load this document rejects — because the demand
path hurts.

With a sidecar, unrouted keys ride on traffic that was happening anyway, so **by
the time a route is wanted it is usually already held**, and nobody is tempted
to fetch in advance.

So a sidecar is not an optimisation of the as-needed model. **It is what stops
the as-needed model eroding into a cache.** `CAPACITY.md`'s decided item 0 — *a
relay spends nothing in anticipation* — survives only while the demand path is
cheap enough that nobody needs to route around it.

| | covers |
|---|---|
| **sidecar** | an active node — routing needs met as a side effect of talking |
| **`about`** | cold start, long absence, or a burst of new contacts while idle |

Recency ordering then puts the keys that matter most on the cheap channel, and
leaves the expensive one for the rare case.

### The rule that must not be got wrong

> **A member-supplied tuple is a hint for that member's own request. A
> relay-discovered tuple is a fact worth sharing. Never let the first become the
> second.**

The sidecar rides **outside the signed text** — it has to, because the text is
the member's packet and must travel intact for the tunnel. So it is unsigned
claim data from an authenticated member. That is fine for routing *their*
request: a bad hint misroutes their own packet, fails, and is dropped.

But if a relay broadcast member-supplied tuples, **any member could poison every
other member's routing with one sidecar** — *"sonny is at evil-relay"* — and the
relay would be the amplifier. Broadcast-and-forget is safe **only** for routes a
relay learned from partners it pinned itself.

### Smaller, if it is pursued

- **A cap of its own.** The sidecar competes with the payload it rides on: a few
  hundred bytes, a handful of keys, refused by number like everything else.
- **Outbound only.** A reply carrying route news is redundant with
  broadcast-and-forget — the stream already delivers that. The useful direction
  is node → relay.

> **Read alongside [WHAT-A-NODE-KNOWS.md](WHAT-A-NODE-KNOWS.md)
> (2026-09-21).** That note asks what a node does with routes it is
> **already being told**; this one asks how a relay FINDS a route nobody
> has. They do not conflict, but the order between them changed: a node
> that keeps what it is handed asks far less, so some of what this
> document exists to make cheap may simply happen less often.
>
> Three of the open items below are answered there — *"which route to
> try"* (the shadow is that state), *"a streamed route is not
> correspondence"* (now `0018`: the route cache belongs to the machine),
> and where node-side route state lives at all. **The harvest problem
> below is untouched by any of it**, and remains the load-bearing one.

## Open, and some of it is load-bearing

**A partner that claims keys it does not hold can harvest forwards.** If B
answers *"yes, I have that key"* falsely, the next forward for it is delivered
to B, which sees the packet. The inner signature stops B impersonating the
recipient, and no valid reply ever comes back — so the route is dropped — but
**one packet was disclosed** per false claim. Two candidate answers, neither
decided:

- *Trust on first use.* A route is provisional until a forward returns a reply
  signed by the expected key. Costs one packet per lie, once. Cheap and
  node-side.
- *Verify against the public census* of the named relay before persisting. The
  node **can** — `/api/relay/who` is public and unsigned, and nodes make
  outbound requests — but on a large relay that is the ship-the-material problem
  again, which is what this whole document exists to avoid.

**Negative results need a lifetime, or they are a cost hole.** If *"nobody holds
this key"* is not remembered, every post to an unroutable contact triggers a
full fan-out, for ever. Remembered for ever, a peer who joins a relay tomorrow
stays unreachable. Neither extreme works and nothing decides the middle.

**Which route to try, when a key has several.** Last one that worked is the
obvious answer and is node-side state nobody has specified.

**Sequential or parallel**, when a node holds several relays. Asking in turn
narrows the second question and duplicates less fan-out; asking in parallel
returns more routes sooner. Different answers to *how much redundancy is worth
the traffic*.

**Is the interest list a subscription?** If a relay pushes presence changes only
for keys somebody declared interest in, the `members × changes` broadcast
becomes `interested × changes`. But the relay is then holding an interest list
per member — which has to be priced against 0013's own test before it is
assumed.
