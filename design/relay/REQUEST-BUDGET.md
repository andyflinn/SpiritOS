# A member's request budget — announced, and honoured

*Design note. Nothing here is built. Feasibility and shape only, measured
against `67e6f03` (2026-09-20).*

> **Andy:** *"if the relay forbids more than one active peerPost(), and
> streams that new limit to its members, does the node have the ability to
> serialize calls via peerPost(), so the worst thing that can happen is:
> it might slow down for the user? also: does the relay send all
> applicable limits to a node upon connect?"*

Two questions, one gap seen from each end. The answer to both is **no,
today**.

## Vision

A member should know what it is allowed, and a node that knows should
turn refusals into latency. The relay stops being a box that says no
after the fact; the node stops spending its budget discovering where the
edge is.

This is already doctrine — decision 0012:

> **Andy:** *"the working relay will broadcast useful information to its
> membership. Members can filter/use that, because bandwidth is generally
> cheap."*
> **Andy:** *"a node, also looking out for itself, is well advised to
> listen and not waste their request budget (variable) on requests."*

**"their request budget (variable)"**. Variable means *told*. Nothing
tells it.

## Feasibility — three gaps, and the third is the root

**1. The cap is not announced.** `caps: { memberPerMin, partnerPerMin }`
is built inside the owner's report (`spirit/run/js/relay.js:3462
@ 67e6f03`) and travels on `statusToOwner()`. A plain member receives
nothing. The in-flight cap is not in `caps` at all.

**2. A node learns its limits by being refused.** The router answers
`429 too many in flight` once a requester is at the cap
(`router.js:108`), `503 router full` when the table is spent
(`router.js:103`), and `409 already in flight` for a duplicate hash
(`router.js:95`). All three arrive *after* the request was made and the
hop was paid for.

**3. THE CAP IS NOT CONFIGURABLE.** `var DEFAULT_PER_REQUESTER = 16;`
(`router.js:27`), and the relay builds its table with
`routerTable.createRouter()` — **no options** (`relay.js:410`). So the
number bounding every member is a hard-coded constant that no
configuration reaches, no report mentions, and no Governor can move.

That third one is the root: a limit that cannot change cannot usefully be
announced, and a limit nobody can announce cannot be honoured.

**4. `peerPost` has no queue.** `waiting[hash]` is a dispatch table, not
a line: each call is sent immediately, and a refusal settles that caller
as a failure. Nothing retries and nothing waits.

**But the right home already exists.** `peerPost` owns comms by the
one-interface rule (`AGENT.md`, *Comms*), already knows what it has
outstanding, and already carries the back-off signal it currently ignores
— `inFlight: !!(body && body.inFlight)` at `peerPost.js:330`. The relay
even distinguishes *already in flight* from *too many in flight*, which
is precisely the difference between "this one is a duplicate" and "wait
your turn".

## Why this is the lever that matters

> **Andy, 2026-09-20:** *"the amount of concurrent requests is a primary
> RAM saver for the relay."*

It is, and the arithmetic says how primary. A relay holds a request from
the moment it opens a route until the reply or the timeout, so the RAM a
router costs is a product of three numbers, all of them in the tree:

```
held bytes  =  requests in flight  x  bytes each  x  how long each is held
```

- **requests in flight** — `DEFAULT_MAX = 256` for the whole table
  (`router.js:26`), `DEFAULT_PER_REQUESTER = 16` per member
  (`router.js:27`)
- **bytes each** — `MAX_ROUTED_TEXT = limits.PAYLOAD_MAX`
  (`relay.js:57`), 16 KB
- **how long** — `ROUTE_WAIT_MS = 15000` (`relay.js:95`)

**So the worst case a relay can be driven to is 4 MB held at once, and it
takes only sixteen members to get there.** One member alone can hold
256 KB for fifteen seconds.

Two things fall out of that.

**Sixteen members fill the table.** `256 / 16` — a relay with seventeen
active members can already be pushed into `503 router full` by sixteen of
them, and the seventeenth is refused for something it did not do. The
per-requester cap is fairness; the table cap is the RAM bound; and today
they meet at an uncomfortably small number of people.

**The timeout multiplies everything.** Fifteen seconds is three times the
ceiling Andy set for it — *"N1 should start with a timeout of maximum 5
seconds (or lower) — timeout duration is a massive factor in the relay's
memory usage"* (cycle 4 blurb, `L5413`). Cutting 15 s to 5 s cuts the
*integral* by two thirds without touching either count.

**Which makes three levers on one axis, not three unrelated knobs:**
`connections1` (how many may be connected), `requestsInFlight1` (how many
each may hold open), `requestTimeout1` (how long each is held). The last
two multiply. A design that moves one without knowing the other two is
tuning a product one factor at a time.

## Proposed shape

**The cap becomes a lever.** By the test in `0015`, a lever earns its
place by moving something the Governor can see — and requests in flight
hold RAM on the relay for as long as they are open, which is the same
axis `connections1` sits on. So `createRouter` takes its bound, the
configuration can set it, and the Governor can move it.
`requestsInFlight1`, `worseAt: 'ceiling'`.

**The relay announces it to members, not only to the owner.** A broadcast
on stream open and again when it changes, carrying the caps a member is
actually subject to. `0012` already says a relay broadcasts to its
membership; this is one more thing on that bus rather than a new one.

**`peerPost` queues to the announced number.** Below the cap it sends at
once; at the cap it waits for a slot. A refusal it did not predict is
still a refusal — the queue reduces them, it does not promise their
absence.

**The queue is bounded, and says so when it gives up.** Unbounded, it
turns a fast honest failure into an unbounded wait, which is worse for a
person than an error. A depth and a deadline, and past either one it
refuses and says which — *"honest about anticipated failures"* rather
than hiding them in latency.

**Per relay, not per peer.** The relay's cap counts by requester key
(`router.js:50`, `countFor`), so the node's line is per relay.

## Decided

Nothing. This note exists so the gaps are recorded rather than
rediscovered.

## Recommended

- Make the per-requester bound configurable **before** announcing it.
  Announcing a constant teaches nodes a number that can never change,
  and they will cache it.
- Announce on the existing broadcast bus rather than a new call.
- Bound the queue from the first version, not later. A queue without a
  deadline is a hang.

## Open

- **Does a node trust an announced budget, or treat it as advisory?** A
  relay could announce a generous number and refuse anyway; a node that
  trusts it absolutely would stall rather than retry.
- **What happens to a queued call when the budget shrinks mid-flight** —
  the Governor lowering the lever while a node holds twelve queued
  requests against an announced sixteen.
- **Whether one member's queue should be visible to its owner.** It is
  latency the person is paying, and nothing reports it.
- **Andy's premise case — a cap of one.** Serialising to one makes every
  conversation strictly sequential. Whether that is *slow* or *unusable*
  is a measurement nobody has taken, and it is the honest test of the
  claim that the worst case is only slowness.
