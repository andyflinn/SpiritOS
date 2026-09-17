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
