# 0013 — A relay is fixed-cost per time-unit

**Decided 2026-09-17. Against `1edc4fe`. The invariant is decided; the mechanism
below is designed and not built.**

> A relay is fixed-cost per time-unit. Simple. (Andy)

## The invariant

**A relay costs its owner the same per month whether the mesh holds ten peers or
ten million.** It is a box somebody rents. The rent does not move.

Everything else in this document follows from taking that literally, and it
gives a single test that replaces several looser ones this tree has been using:

> **Does this make a relay's cost a function of anything other than time?**

If it does, it is wrong by construction — not by preference, and not because
somebody dislikes it.

## What the test already decided

Each of these was argued separately, on its own terms. They are one rule.

| decision | the same test |
|---|---|
| no partner member lists ([0012](0012-a-relay-never-asks-for-a-member-list.md)) | cost would track **other people's** membership |
| nothing stored on anyone's behalf ([0006](0006-fast-and-true-not-guaranteed.md)) | cost would track **accumulated history** |
| persist levers, not statistics (`relay/CAPACITY.md`) | levers are constant-sized; statistics grow |
| a relay spends nothing in anticipation (`CAPACITY.md`, 0) | cost would track **the mesh**, not the members |
| two budgets, members and partners (`CAPACITY.md`, 0c) | a fixed capacity is **divided**, never exceeded |
| the governor | holds a fixed cost against a demand curve it does not control |

It also explains the contrast `relay/PARTNERS.md` already draws: *"this is the
opposite shape from a mail server, and deliberately: a mailbox accumulates and a
relay does not."* **A mailbox is cost-per-byte-per-month. A relay is
cost-per-month.**

## Where the growth goes, and why that is sustainable

Growth is real; it has to land somewhere. It lands on **nodes**.

Node-side state scales with how many people there are, and **each person pays
for their own**. Nobody's box grows because somebody else made friends. That is
the whole sustainability argument, and it is why the network can grow without
any participant's bill growing.

So:

> **The network's durable memory lives in nodes. Relays are fast, ephemeral, and
> re-primed by the nodes they serve.**

A relay keeps what it is *doing*. A node keeps what it *knows*.

## The owner's incentive points the same way

> **Andy:** *"the relay owner should be interested in externalizing as much cost
> as possible."*

This is the property worth having, because it means the architecture does not
depend on anybody's discipline. An owner acting purely in self-interest — push
work to whoever's demand created it — does exactly what this decision wants.

**But it needs a boundary, or it becomes the thing it prevents:**

> **Externalize memory, never service. To the demanding node, never to a peer
> relay.**

- **Never to a peer relay.** A partner's cost is also somebody's fixed cost. If
  every owner externalizes onto partners, every box looks fine and the mesh
  degrades. That is what the two budgets, the single-target forward and the
  rationing of partner posts actually prevent — they stop *externalize* from
  meaning *dump on my partners*.
- **Never the service.** Carrying packets and holding streams is what a relay
  **is**. Remembering is not. So self-interest lands precisely on state, which
  is the thing this decision moves anyway.

It also gives the shedding order its reason (`CAPACITY.md`, decided 7):
performance is service **degraded** and recoverable; reach is service
**withdrawn**. A fixed-cost box meeting variable demand must shed something, and
it sheds the recoverable thing first and the relationship never.

## The live defect this exposes

**`streamRoster` ships the full member list to every member on every connect**,
and nothing caps it. Measured at `1edc4fe`:

```
one roster row      = 101 bytes
  190 members       =  19 KB   ← already past PAYLOAD_MAX
1000 members        =  99 KB   to every member, on every connect
```

A thousand-member relay in a reconnect storm sends ~99 MB, and laptops flap.
Beside it, `presentNow.broadcast` sends **every presence change to every
member**, which is `members × changes`.

Both fail the test: the cost tracks membership, not time.

And it is the defect `search` was built to fix, in the one place nobody looked —
`relay.js` says so in the same file: *"The node used to fetch every census WHOLE
and subtract what it knew. At ten members that is a list; at a thousand it is
150 KB per relay to render something nobody can read. So the relay answers the
question instead of shipping the material."* **The roster ships the material.**

It exists for one reason: the three-state dot. The full list is what lets a node
tell *"member, away"* (red) from *"this relay never heard of them"* (white).

## The mechanism (designed, not built)

One request shape answers routing **and** presence, and both scale with the
asker's own book rather than the relay's membership:

```
node → a relay it is bound to:   { about: [ keys, with any route tuples it holds ] }
relay:  mine?          → answer locally, no fan-out
        tuple I can use? → keep it, no fan-out
        otherwise       → that remainder goes to partners
relay → node:  per key — bound where, present or not
```

- **bound + present** → green **· bound + absent** → red **· not bound
  anywhere** → white.
- **Only a relay the node is bound to is ever asked.**

  > **Andy:** *"the mechanism for finding ANY route to any peer must go through
  > relays I'm bound to."*

  A node never speaks to a partner, has no relationship with one, and now has no
  reason to want one. Reach expands; **relationships do not**.
- **The called relay does not fan out keys it holds itself.** It answers those
  locally; only the remainder costs a partner anything.
- **The node sends the tuples it already has**, so the relay can cull ones
  naming relays it does not partner with, and skip the fan-out for the rest.
  It does **not** verify them: a stale tuple is cheaper to *use* and let the
  forward fail than to check. The failure is the verification.
- **Bulk and prioritised, because none of it is free.** The ask costs the
  member a post, the local resolution costs the relay CPU, and the remainder
  costs the relay's standing in each partner's pool. So: one post per batch, in
  recency order — which `traffic.jsonl` already supplies, and whose retention
  window conveniently *is* the priority window.
- **The reply is by reference** (`PARTNERS.md`, tier three): a relay table once,
  then an index or bitmask per key. By value it is `K × P × ~90 B`, which at 19
  partners caps a batch at **nine keys**. By reference it is ~330.
- **The cap is the answering relay's to set and to name**, because only it knows
  its own partner count — the same shape as the rate limit, refused with the
  number in it.

## The amendment to 0012

0012 says the `partners × members` term **does not appear anywhere, at any hop
count**. Under this decision a relay may hold a **working set** of routes in RAM
— keys its own members asked about — which is a form of that term.

The distinction is the one this decision rests on, and it is worth stating
exactly rather than leaving to a reader:

- **It is never persisted.** A relay that reboots is re-primed by its members'
  next requests. Boot stays `O(own members)`.
- **It is never fetched as a roster.** There is still no verb that delivers a
  partner's members, which is 0012's structural guarantee intact.
- **It is bounded by member demand**, not by partner membership — so it is a
  function of this relay's own members, which is what the invariant permits.

So 0012's sentence should read: **no stored term, and no verb that fetches
one.** A demand-shaped, member-primed working set in RAM is a different thing,
and is what "relays are re-primed by the nodes they serve" means in practice.

## Open

- **How many routes per key** the reply should carry. A bitmask gives all of
  them for three bytes; whether a node wants all, or the best two, is a
  resilience-versus-traffic question nobody has answered.
- **Sequential or parallel** when a node holds several relays. Asking them in
  turn narrows the second question and duplicates less fan-out; asking in
  parallel gets multiple routes at once.
- **What replaces the roster**, exactly, and what a node that has declared no
  interest in anybody should receive. Today it receives everything.
- **Whether the interest list is a subscription.** If a relay pushes presence
  changes only for declared keys, the `members × changes` broadcast becomes
  `interested × changes` — but the relay is then holding an interest list per
  member, which must be priced against this decision's own test.
