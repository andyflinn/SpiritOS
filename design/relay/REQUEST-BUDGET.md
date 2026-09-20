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

## The proof case already exists, and it is nearly free

> **Andy:** *"with the current response times, there will lie the proof
> that it's not going to kill the user, in practice.... in fact, if the
> relays stream or broadcast confirmations, the UI can actually show
> status updates on the operation."*

`info.js:281` `infoPush` is the only node-side fan-out in the tree — a
rename posted to every relay this node holds a seat on. It is already
built the way a queue needs:

> *"EVERY RELAY IS ASKED INDEPENDENTLY and one refusal costs the others
> nothing. That is not politeness, it is the only workable rule: a relay
> may be down for days, and an all-or-nothing save would mean nobody can
> ever change their name while one box is offline."* — `info.js:277`

And `infoPushed[row.url]` is written **the moment each relay answers**,
with its own reason on failure (`info.js:290-305`), and is already drawn
from at `info.js:220`. What is missing is a repaint inside each `.then`:
today the screen says *"saved — telling 3 relay(s)…"* and then nothing
until all three settle.

**So per-relay progress is one `infoDraw()` call, not a feature.** Under
a cap of 1 that turns a silence into rows ticking over one at a time,
which reads as working rather than as frozen.

**And the confirmations already stream.** No new broadcast is needed:
*request by post, reply by stream* (`AGENT.md`, Comms) is peerPost's
inbound half, and `settle(hash, answer)` already dispatches each reply to
the caller that asked. The UI simply does not repaint on arrival.

An operation built as a batch would not degrade into a queue gracefully.
This one was built independently per relay, which is why it is the
honest test.

## What the timeout ceiling can and cannot be argued from

> **Andy:** *"ROUTE_WAIT_MS i'd even set a lower ceiling, again, based on
> response times i experience and RAM savings on the relay."*

Measured 2026-09-20 from the work box:

| | |
|---|---|
| work node, loopback | **~3 ms** (200, five samples) |
| spirit-3, TLS | **130–167 ms** (200; connect 50–230 ms) |

A peerPost round trip is four hops, not one — node→relay, relay→peer,
peer→relay, relay→node — plus the peer's own processing. At spirit-3's
latency that is roughly **0.6 s of transport** before the peer has done
anything. So a **2 s ceiling is about three times the observed
transport**, where 5 s is about eight and 15 s about twenty-five.

**The RAM argument is linear and large.** Held bytes scale directly with
how long a route stays open, so 15 s → 2 s is a **7.5x reduction** in the
integral, with no change to either count.

**The counterweight, which is real:** a timeout tight enough to fail a
slow-but-working peer converts one held request into a retry — two
attempts where there was one, and *more* relay RAM, not less. The
ceiling's job is to bound the pathological case, not to discipline a
peer having a slow second.

**And the honest position is that nobody has measured the thing that
matters.** These are transport latencies. A peerPost round trip is not
recorded anywhere: `trafficLog` carries no duration, and `routes.open`
already stamps `at` and the entry is deleted on reply — so the lifetime
is computed and thrown away.

**Recording route lifetime is cheap and would make this ceiling a
measurement instead of an argument.** It is also exactly cycle 1's own
method: *"first we only measure cheap measurements, that is enough to
prove the overall design... then we learn from the results."*

## A node's concurrency is relays x cap, by construction

> **Andy:** *"if a node fans out a search to all relays it is connected
> to and has more than one valid route for the request target, it can also
> spread the load by routing concurrent requests via different relays. it
> looks out for #1 as well."*
> *"this won't matter to the node because it has two different relays it
> is a member of, and even if those relays use the same route, it still
> gives the node two concurrent accesses to that route."*

**The cap counts inside the router table of the relay posted to**
(`router.js:50`, `countFor`, keyed by requester). Two relays are two
tables and two independent counts, so a member of two relays has two
slots under a cap of 1 — and it holds even when both relays forward down
the same onward route, because that hop is the relays' business and
costs the node nothing.

**No routing knowledge is required for this**, which matters because
cycle 2 deliberately removed it:

> *"The first connected relay, because which one partners with the hinted
> relay is the relays' knowledge, not this node's… that relay knows which
> of them it partners with and which are live, so it chooses — the node
> does not guess."* — `hub.js:935`

Spreading across **relays you are a member of** takes nothing back from
that decision. The node is not choosing a route; it is choosing which of
its own doors to knock on.

**And a wrong door is cheap.** A relay that cannot reach the target
refuses at once — *"it refuses an absent target at once (0006, 503 peer
not reachable)"* (`hub.js:941`) — so a guess costs a fast refusal rather
than a timeout, which is what makes spreading safe to attempt without
knowing.

**A mesh-wide search already costs one slot.** The fan-out is relay-side:
the node posts one search and `relay.js:2703` has the relay ask its
partners in parallel and merge. The most expensive-sounding operation a
node can perform occupies a single slot however large the mesh — an
argument for the cap rather than against it.

**Three consequences worth carrying.**

How many relays a node joins becomes a **capacity** decision as well as a
resilience one. That is new, and it is a good property: a node that wants
more concurrency joins another relay, which also spreads the RAM it costs
across more boxes.

**A single-relay node gets exactly one slot**, and that is the real test
case for cap 1 — not Andy's three-row node.

And the downstream bottleneck is unaffected: if both relays forward to
the same partner, each forwarding relay spends its own slot on that
partner's table under its own key (`relay.js:1969`), where one requester
identity still carries all of its members. The partner pool needs its own
bound regardless of how well the node spreads.

## The downstream bottleneck is the relay's, and a strict member cap helps it

> **Andy:** *"the downstream bottleneck is the relay's problem, and that
> makes the stricter limit even more sensible."*

It does, and by the same factor. At 16 per member, sixteen members can
put 256 requests in flight and every one needing a partner becomes an
outbound forward. At 1 per member that ceiling is 16 — **sixteen times
less pressure on the forwarding path**, from the same change.

So the member cap moves **two** RAM pools: routes held locally, and
forwards this relay will have to spend on its members' behalf. By 0015's
test — a lever earns its place by moving something the Governor can see —
that makes `requestsInFlight1` a stronger lever than `connections1`.

**It does not reach what arrives.** Inbound partner forwards open routes
under `mineKey()` (`relay.js:1969`), so every partner's members share one
requester identity on this relay's table. That is other relays' traffic
and a member cap cannot touch it.

**Which names three budgets, not one**, and only the first is usefully
strict:

| | what it bounds | who it is for |
|---|---|---|
| **member in-flight** | what each member may hold open here | strict — 1 is the proposal |
| **forwarding** | what this relay spends asking partners on its members' behalf | falls with the member cap |
| **inbound partner** | what this relay accepts from other relays | its own bound, its own argument |

The precedent is already in the tree: `caps: { memberPerMin,
partnerPerMin }` keeps two pools because they are two populations. The
in-flight bound needs the same split, and for the same reason.

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
- **Cut `ROUTE_WAIT_MS` before setting the member cap to 1.** At 15 s a
  single unanswered relay blocks the next request for fifteen seconds,
  and the progress rows would sit still long enough to read as broken. We
  would blame the cap for the timeout's cost and learn the wrong thing
  from the experiment.
- **Record route lifetime before arguing the ceiling further.** The
  number is already in hand at close time and is discarded.
- Add the repaint to `infoPush` — one call, and it is what makes
  serialisation legible.

## Open

- **Does a node trust an announced budget, or treat it as advisory?** A
  relay could announce a generous number and refuse anyway; a node that
  trusts it absolutely would stall rather than retry.
- **What happens to a queued call when the budget shrinks mid-flight** —
  the Governor lowering the lever while a node holds twelve queued
  requests against an announced sixteen.
- **Whether one member's queue should be visible to its owner.** It is
  latency the person is paying, and nothing reports it.
- **How low the ceiling goes.** 2 s is three times observed transport and
  a 7.5x RAM saving against today's 15 s. Lower is possible and is a
  measurement nobody has taken.
- **Andy's premise case — a cap of one.** Serialising to one makes every
  conversation strictly sequential. Whether that is *slow* or *unusable*
  is a measurement nobody has taken, and it is the honest test of the
  claim that the worst case is only slowness.
