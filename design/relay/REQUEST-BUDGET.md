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

**And it eases what arrives too, which this note first denied.**

> **Andy:** *"the 1 request in flight eases the relay's burden from both
> sides."*
>
> *Corrected in place. The paragraph here first read "it does not reach
> what arrives", which analysed one relay in isolation and is only true
> of a relay whose partners do not share the cap.*

Inbound partner forwards do open routes under `mineKey()`
(`relay.js:1969`), so every partner's members share one requester
identity on this relay's table — that part stands. But **what arrives is
what a partner's members were allowed to send.** The cap is
`DEFAULT_PER_REQUESTER` in the shipped code, so it travels with releases:
in a mesh running the same build, A forwards one per member instead of
sixteen and B's inbound falls by the same factor without B doing
anything. One number, both sides.

**The inbound bound is therefore a defence against divergence, not the
primary mechanism.** A partner on an older release, or one whose owner
raised its own member cap, exports that pressure to everyone it partners
with — and `mineKey()` means it arrives as a single identity that cannot
be told apart from a well-behaved partner. That is what the third budget
is for: not the ordinary case, which the default already handles, but the
relay that does not share it.

**Which names three budgets, not one**, and only the first is usefully
strict:

| | what it bounds | who it is for |
|---|---|---|
| **member in-flight** | what each member may hold open here | strict — 1 is the proposal |
| **forwarding** | what this relay spends asking partners on its members' behalf | falls with the member cap |
| **inbound partner** | what this relay accepts from other relays | a defence against a partner that does not share the default |

The precedent is already in the tree: `caps: { memberPerMin,
partnerPerMin }` keeps two pools because they are two populations. The
in-flight bound needs the same split, and for the same reason.

## Reach over speed

> **Andy, 2026-09-20:** *"reach over speed."*

That is the judgement the whole trade turns on, and it is worth stating
plainly because it decides the next one too. A cap of 1 costs a node
latency. It buys a relay **sixteen times the members on the same table**,
and eases the mesh on both sides from a single default.

It is also what makes Andy's own stated ambition arithmetic rather than
aspiration:

> **Andy:** *"i might want a relay to provide 1000 friends with a fairly
> private/verified connectivity."* — cycle 4 blurb, `L2298`

At sixteen in flight per member, **sixteen friends exhaust the table**
and the seventeenth is refused for something they did not do. At one, the
same 256 slots serve 256 concurrent askers — and a thousand members are
overwhelmingly idle at any instant, so the table is sized for the askers
rather than the membership.

A relay that is fast for sixteen people is not the relay this project is
for. `0013` already says a relay is fixed-cost per time unit; reach over
speed is what that costs the person asking.

## The relay-side budget stays separate, and gets up to 16x smaller

> **Andy:** *"we always know that relay side request for relays must be
> subject to a separate budget. thing is even that load can be reduced by
> up to 16x if all relays have node-side limits of 1."*

Both hold at once, and they are not in tension.

**Separate, because it is a different population.** Forwarding and
inbound partner traffic are not members, arrive under one identity
(`mineKey()`, `relay.js:1969`), and answer to a different argument.
`caps: { memberPerMin, partnerPerMin }` already splits on exactly this
line.

**And up to sixteen times smaller, because what a relay must forward is
bounded by what its members were allowed to hold open.** At 16 per
member the forwarding ceiling is sixteen times higher than at 1 — and
the same is true of what arrives, since a partner's outbound is its own
members' allowance. One number, both directions, mesh-wide.

**The saving is in what must be PROVISIONED, not in what is typically
used.** Most members are idle whatever their cap; the typical forwarding
load barely moves. What moves is the **ceiling** — and a budget is sized
for the ceiling, which is what makes this the difference between a relay
that fits a 1 GB box and one that does not.

That is `0013` from the inside: *a relay is fixed-cost per time unit*.
The fixed cost is set by what the worst case demands, so lowering the
worst case is how the fixed cost comes down.

**Which makes the member cap a protocol property rather than a local
setting.** The benefit only accrues while the mesh shares it: a relay
that raises its own exports the pressure to everyone it partners with.
That argues for 1 as the shipped default, with a raise being a
configured, visible divergence — the same shape as `settable` in 0015.

## The cap is computable, not a magic number

> **Andy:** *"it is computable though, based on configured MAX_MEM."*

**And the constants already encode a memory budget without saying so.**
`DEFAULT_MAX = 256` slots (`router.js:26`) times `PAYLOAD_MAX = 16384`
(`limits.js`) is **exactly 4 MB**. Somebody sized that against memory and
then wrote it as a slot count, so the reasoning vanished and the number
survived. Deriving it puts the reasoning back.

The shape it wants is the one `connections1` already has — a ceiling
computed from `ramLimitMB` rather than declared:

```
request budget   =  a declared fraction of ramLimitMB
table slots      =  request budget / PAYLOAD_MAX
member cap       =  derived from the budget, floor 1
```

**So "freeze at 1" is really "freeze at the floor."** A small box computes
1 and cannot compute less. A box with headroom may compute more, and has
the memory to mean it. The floor is what the protocol guarantees; the
computation is what a generous box is allowed to add.

**And that resolves the divergence problem better than a uniform default
would.** If every relay computes its budgets from its own `MAX_MEM` —
member, forwarding **and inbound** — then a generous relay cannot hurt a
small one, because the small one bounds what it accepts by its own
memory rather than trusting its partners to be modest. Uniformity stops
being required. What the protocol needs is not that everyone picks the
same number, but that **everyone enforces their own**.

**Nothing is computed today.** `createRouter()` is called with no options
at all (`relay.js:410`), so the table size, the per-member cap and the
4 MB assumption behind them are fixed at build time and reach no
configuration. That is the same root gap as §Feasibility 3, seen from the
other end: a number that cannot be computed cannot be declared, and a
number nobody declares cannot be reasoned about.

**One thing this needs that does not exist:** the fraction of
`ramLimitMB` a relay should spend on held requests. `STREAMS_PER_MB = 16`
is the precedent and is honest about itself — *"PLACEHOLDER. Guessed so
the ceiling is finite… replaced by the per-stream cost cycle 1
measures."* The request fraction deserves the same treatment: declared, a
guess, and named as one until route lifetimes are recorded.

## The experiment: what actually breaks at 1

> **Andy:** *"so we have to make a plan to freeze (at least for now) the
> requests in flight/relay/member down to one, until it is proven that the
> system breaks because of that limit."*

Run 2026-09-20 before planning anything: `DEFAULT_PER_REQUESTER` set to
`1`, full harness, then reverted. **105 suites, 2454 green, 12 red across
4 suites.** Every failure was `429 too many in flight`.

| suite | red | what it means |
|---|---|---|
| `routeHints.js` | 4 | a fixture that never answers — see the correction below |
| `relayMeter.js` | 5 | asserts *"2000 posts and never a 429 — routePost is unlimited"* |
| `devicePeers.js` | 2 | a pairing exchange; fixture artefact or real concurrency, not yet told apart |
| `relayMonitor.js` | 1 | a peer reaching the monitor while something else was open |

**`routeHints` does NOT confirm the prediction, and this note first said
it did.**

> **Andy:** *"My bet is: if the node can throttle, this goes away."*
>
> *Corrected in place. Checking that bet found the over-claim.*

`routeHints`'s `askPartner` returns `new Promise(function () {})` —
*"the answer is not under test here"* (`routeHints.js:61`). Every forward
it makes stays open **forever**, so at cap 1 the first one takes the slot
and nothing ever frees it. That is a fixture that never replies, not a
relay that cannot forward.

**The production concern is still real, but it is reached by inspection
rather than by this suite.** Forwarding opens routes under `mineKey()`
(`relay.js:1969`), so one *unanswered* forward holds the relay's only
slot for the whole of `ROUTE_WAIT_MS`. At 15 s that stalls every forward
the box makes. The split is still the prerequisite — but because of the
timeout and the shared identity, not because a suite went red.

**And Andy's bet is largely right.** Of the twelve, the ones caused by a
node holding two requests open would be absorbed by a queue rather than
refused: `relayMeter`'s 2000 posts become 2000 waits, `devicePeers` and
`relayMonitor` serialise and complete. What a node queue **cannot**
absorb is the relay's own forwarding, because that is the relay's
accounting and no node is party to it.

**`relayMeter` is a policy statement wearing a test.** *"routePost is
unlimited"* was true and is exactly what this change repeals. That
assertion has to be rewritten deliberately, by someone who means to
repeal it — which is what makes it a decision rather than a red suite
somebody adjusted.

**`devicePeers` and `relayMonitor` are the interesting two**, because
they are the only candidates for a *legitimate* node flow needing more
than one request open. Until each is shown to be a fixture sharing one
identity, they are the honest evidence about whether 1 is survivable.

## The plan, in the order the evidence dictates

1. **Split the requester classes.** Member, this relay forwarding, and
   inbound partner — three counts, not one. `caps: { memberPerMin,
   partnerPerMin }` is the precedent. Without this, nothing else can
   proceed.
2. **Cut `ROUTE_WAIT_MS`.** At cap 1 the timeout *is* the user's latency,
   and 15 s would make the cap look broken when the timeout is at fault.
3. **Record route lifetime.** The number is already in hand at close and
   discarded. Without it, every later argument about the cap is anecdote.
4. **Resolve `devicePeers` and `relayMonitor`** — fixture or real. If
   real, that is the first honest evidence against 1, found before
   shipping rather than after.
5. **Rewrite `relayMeter`'s claim** as the repeal it is.
6. **Add the `infoDraw` repaint**, so serialisation reads as progress.
7. **Then set the member cap to 1**, with a census asserting it, in the
   shape `settableCensus.js` already uses.

## What "proven to break" has to mean

The freeze is only a freeze if the burden of proof has a shape.
Otherwise the first person who finds it slow raises the number, and the
default was never a default.

**Not proof:** it feels slow; a suite went red; one operation takes
longer than it used to.

**Proof:** a named flow that *cannot complete* at 1 and completes at 2 —
or a measured queue wait, against recorded route lifetimes, that exceeds
what a person will tolerate for an operation they asked for. Both require
step 3 to exist first, which is why measurement precedes the freeze
rather than following it.

## The red line: a large relay overwhelming a small one

> **Andy:** *"a large memory relay can overwhelm a small-RAM relay.... if
> all is programmed well, that's one of the biggest red-line risks i
> see."*

The sharpest thing about it is the qualifier. This is not misconfiguration
or an old release — **capacity asymmetry alone is enough**, with every box
behaving correctly. A relay with more memory has more members generating
more forwards, and they all arrive at a small partner under one identity
(`mineKey()`, `relay.js:1969`).

**Nothing paces per partner today.** No per-partner budget, no queue, no
back-off: a relay offers forwards at whatever rate its members produce
them.

**Where the damage lands depends on whether the small relay has an
inbound bound**, and the two cases are different problems:

**Without one — which is today — the small relay is genuinely
overwhelmed.** No defence exists. This is the immediate risk and it is
why the third budget is not optional.

**With one, the small relay survives and the harm moves.** Refusal is
cheap for the refuser: B says 429 and is fine. The cost lands on **A's
members**, who see failures when they talk to B's members. Small relays
then look *unreliable* rather than being *broken* — and people migrate to
the big ones. **That is the real red line: not a crash but a slow drift
to centralisation**, which is the premise of this project failing quietly
rather than loudly.

**And the fix is Andy's own principle, one layer up.** If A *paces* to
B's announced budget instead of offering blindly, A's members **wait**
rather than fail. A small relay becomes slow to reach, not broken —
**reach over speed**, applied relay to relay.

**Which is why this needs no second mechanism.** `AGENT.md`: *"A relay is
a client of the same interface… `createPeerPost` already takes `traffic`
injected so a relay can omit it — it was built to be constructed on a
relay."* A queue built in `peerPost` for the node serves the relay's
forwarding unchanged. **Announce, queue, bound — the same three things,
at both layers, from one implementation.**

**One asymmetry to keep in view:** a member that is refused can pick
another of its relays (relays x cap). A relay that is refused by its
partner has no such choice — the partner is the only route to that
partner's members. So pacing matters more between relays than between a
node and its relay, which is the opposite of where the effort has gone
so far.

## What actually bounds a small relay: the target, not the sender

> **Andy:** *"if my node relay can have a max of 10 members, and each
> member has 100 contacts, they cannot get more than a hundred messages at
> the time, because they can only deal with one at a time.... in practice
> the spam from a large-scale-relay would be proportional to members x
> member-contacts."*
> *"my relay can check if a request is in flight for the same
> originator/target combination without wasting memory. those will be
> rejected outright."*
> *"cap the requests for a specific target at one, respond with (not
> available); if this causes the calling node to keep the request queued,
> nothing is lost."*

**The addressable surface is the receiver's membership, not the sender's
capacity.** A ten-thousand-member relay cannot address more than ten
members, because those are the only targets that exist, and
`forwardToMine` refuses an unknown target *before opening a route*. That
inverts the intuition that made this a red line: inbound scales with the
size of the relay being written to.

**Two bounds follow, and the data for both is already stored.**
`pending[hash] = { requester, target, at, carry }` (`router.js:111`), and
`countFor` already filters that map — so each is the same scan with one
more predicate. **No new state, no new memory.**

**Per pair — one in flight per `(originator, target)`.** Today's `409
already in flight` keys on the *hash*, so different content is a
different route and one identity can hammer one target freely. Per-pair
closes that. It matters most where per-requester is useless: inbound
forwards all carry `mineKey()`, so every member of every partner counts
as one requester, while the **pair stays distinct per conversation**.
That is the bound that works where the requester bound cannot.

**Per target — one in flight per member, from anyone.** This is the one
that ends the argument: **inbound routes <= member count**, whatever the
sender's size or intent. Ten members, ten routes. Per-pair defeats
amplification by repetition; **per-target defeats amplification by
identity count**, which per-pair does not — a Sybil farm produces
distinct pairs but cannot produce distinct targets.

So a small relay's inbound budget is a function of its own membership,
which `MAX_MEM` already bounds. **Small and correct**, rather than small
and overwhelmed.

**The refusal must be distinguishable, and this is the part that is easy
to get wrong.** *"Not available"* means *the target is here and busy —
queue and retry*. `503 peer not reachable` means *gone — do not bother*.
Same shape, opposite instruction, and a caller that confuses them either
abandons a reachable peer or hammers an absent one. They need different
errors and the node needs to act on the difference.

**And nothing is lost, provided the caller queues** — which is the node
queue this note already argues for, and Andy's own principle again: a
busy member becomes **slow to reach, not unreachable**. Reach over speed,
a third time, now between two members of the same mesh.

**What it costs honest traffic:** a momentarily popular member becomes a
bottleneck for their correspondents. At human message rates and a 1-5 s
timeout that is invisible. At today's 15 s it would not be — the timeout
cut is a prerequisite here too.

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
