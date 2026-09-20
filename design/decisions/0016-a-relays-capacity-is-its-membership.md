# 0016 — A relay's capacity is its membership

**Decided 2026-09-20 by Andy. Measured against `2e6d6e5`.**

> **Andy:** *"for relay this means MAX_REQUESTS_IN_FLIGHT =
> MAX_MEMBER_ROLL_SIZE.... all equations simplified. many ceilings
> implicit constants."*
> *"reach over speed."*
> *"the member suffers from hanging requests. the blockage lies there.
> the system itself doesn't suffer."*
> *"let's at least commit to revising the design."*

## The decision

**The design is revised in this direction.** Nothing here is built, and
the numbers below are not all settled — what is decided is that the
request budget stops being a set of chosen constants and becomes a
function of one configured bound.

```
MAX_MEM  ->  member roll size  ->  routes in flight  ->  request RAM
```

Every ceiling below the first is derived. `DEFAULT_MAX = 256` stops being
a number somebody picked and becomes arithmetic. The per-requester and
per-target caps become the constant `1`. Four independent, unargued
numbers become **one configured bound and three constants**.

The working note is
[design/relay/REQUEST-BUDGET.md](../relay/REQUEST-BUDGET.md), which
carries the evidence, the arithmetic and the open questions. This file
records only what is committed.

## What is committed

**A relay's in-flight capacity is bounded by its own membership**, not by
what its partners can generate. A route has two ends and both are capped,
so the worst case is `2 x members` — reached only when every conversation
crosses the relay boundary.

**Caps of 1, in two directions.** One in flight per member as *requester*;
one per member as *target*. The second is the one that needs no
cooperation from anybody: it bounds what a hostile or merely large
partner can aim at a member, because a Sybil farm produces distinct pairs
but cannot produce distinct targets.

**Requester classes are separated.** Member, this relay acting for its
members, and inbound partner traffic are three budgets, not one. They are
three populations and answer to three arguments; `caps: { memberPerMin,
partnerPerMin }` is the precedent.

**A node queues rather than fails.** Refusal becomes latency. This is
*reach over speed* — the judgement the whole design turns on, and the one
that resolved the same trade three separate times in the sitting that
produced it.

**Rolls are bounded by age as well as by space.** An allotment evicts
under pressure and bounds quantity; staleness evicts on its own schedule
and bounds age. Neither substitutes for the other, and a roomy disc
without the second leaves a roll **frozen** — nobody admitted, nobody
released. Recorded in `NODE-AND-RELAY.md` §8.

## What this supersedes

**The unargued constants.** `DEFAULT_MAX = 256` and
`DEFAULT_PER_REQUESTER = 16` were never derived from anything stated.
Their product is exactly 4 MB, so somebody sized them against memory and
then wrote them as slot counts, and the reasoning vanished while the
numbers survived.

**A ceiling reachable by sixteen people.** At 16 per member, sixteen
members exhaust the table and the seventeenth is refused for something
they did not do. That is what makes *"1000 friends"* arithmetic rather
than aspiration: at a cap of 1 the same relay costs **31 MB**.

**And one of Andy's own earlier claims.**

> *"timeout duration is a massive factor in the relay's memory usage."*
> — 2026-09-19

True at a cap of 16, where occupancy and the table ceiling interact.
**Superseded at a cap of 1:** peak RAM is `2N x PAYLOAD_MAX`, set by the
caps and independent of `ROUTE_WAIT_MS`. The timeout becomes a **latency**
parameter, governing how long a *stuck* slot stays stuck — the waiting
member's experience, not the relay's exposure. It must therefore be
argued from human patience, on evidence this project does not yet have.

## What is proven, and what is not

**Proven** (2026-09-20, by running it):

- **Nothing in this tree needs more than one request in flight per
  member.** The cap was set to 1 and the harness run: 12 red across 4
  suites, and every one was either a fixture that never answers
  (`routeHints`, `relayMonitor`), a policy assertion due for repeal
  (`relayMeter`'s *"routePost is unlimited"*), or relay-side.
- **The relay-as-requester bottleneck is real**, not a fixture.
  `devicePeers` makes two `deviceOffer` calls to two different members;
  a device offer is the relay posting as itself, so both open under
  `mine.publicKey` and the second is refused at a cap of 1.

**Not proven, and named so it is not mistaken for settled:** the per-pair
and per-target bounds (never implemented), the node queue turning refusal
into latency (never built), relay-to-relay pacing (never built),
`2N x PAYLOAD_MAX` as the real peak (arithmetic, unmeasured), staleness
eviction being necessary (reasoned, never observed), and the timeout
ceiling (**no evidence at all** — the RAM argument was retired above and
nothing replaced it).

## It is also a reset in priorities

> **Andy:** *"It's also a reset in priorities, as a decision."*

This displaces the staging cycle 4 was planned around. The request budget
appears nowhere in it and cuts across two of its pieces:

| planned | under 0016 |
|---|---|
| **4.2** `levers.json`, clamping, `requestTimeout1`, generic test layer | the budget comes first; `requestTimeout1` survives but as a **latency** lever, its RAM justification retired above |
| **4.3** counts and bounded roll questions | now partly decided — `NODE-AND-RELAY` §8 has the age bound; what remains is the numbers and the admission policy |
| **4.4** `All` / ranking / cadence switch | the `All` view and ranking were built 2026-09-20 ahead of schedule; the cadence switch is untouched |

**Why it goes first rather than fitting in.** The cap is a constraint on
every app written after it, and an app written before it assumes
concurrency it will not have:

> **Andy:** *"I do think that this should take priority to prove. because
> it will simplify the game later, give us UI guidelines etc."*

Building a constraint before the things constrained by it is cheaper than
retrofitting them. That is the whole argument for the reorder, and it is
a sequencing argument rather than an importance one.

**The smallest first step, named by the evidence rather than by
preference:** the **requester split**, which `devicePeers` proves is
needed, and **per-target**, which is one predicate over data already held
in `pending`. Those two are what let a cap of 1 be *tried* rather than
argued. Announcement, queues, pacing and staleness all depend on them.

**What this does not erase.** Cycle 4.1 is built and green but its own
verification is unfinished: the shed remedy and `dynamic` handing the
lever back are tested and have never been *seen*, and `0015` made them
dormant before they were. The plan treats those as two different things
and they still are.

## What is NOT decided

- **The numbers.** `MAX_MEM`'s split across pools, the staleness
  ceilings, the node-local timeout, `ROUTE_WAIT_MS`.
- **Admission policy when a roll is full** — whether a newcomer may evict
  the stalest seat on demand or must wait for one to lapse. Different
  policies, opposite answers to *"can I join a popular relay today?"*
- **The node scheduler's shape.** Andy: *"the node must not only queue,
  it also must have a hook for not-available responses, requeuing with
  node-local timeout, and processing the queue while waiting for a
  retry."* Two hazards are known and unresolved: **head-of-line
  blocking** (a FIFO queue stalls behind one busy target, so dispatch
  must skip backed-off targets) and **two timeouts that can fight** — a
  node-local timeout shorter than the relay's leaves the relay holding a
  route the node has abandoned, which at a cap of 1 costs that member
  every slot they have. A **cancel verb** resolves the second; `cancel`
  already exists and already enforces that only the opener may call it,
  but nothing exposes it to a member.

## The cost of waiting

Low in code and rising in design. Nothing is built, so nothing has to be
unbuilt. But every app written before the cap lands is written assuming
concurrency it will not have — which is why Andy asked for this early:

> **Andy:** *"I do think that this should take priority to prove. because
> it will simplify the game later, give us UI guidelines etc."*

The guideline is available now, ahead of the apps that need it: **one
request at a time is what an app may assume.** An app written to that
needs no retrofit; one written without it does.
