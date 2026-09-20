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

`info.js:281` `infoPush` is **one** node-side fan-out — a rename posted
to every relay this node holds a seat on. It is already built the way a
queue needs:

> *Corrected 2026-09-20: this first said "the only node-side fan-out in
> the tree". **`contacts.js:595` `contactsAskEveryone` is the bigger
> one** — it loops `contactsSeen` and fires a `peerPost({describe:true})`
> per contact, all at once, so its width is the contact count rather than
> the relay count. Missed because the call site was read and its caller
> was not. It is the harder proof case and the more visible one:*
>
> **Andy:** *"visually verifying that natter and contacts still react as
> lively as before..."*
>
> *And it is already built for a queue too. `contactsCards[key]` is
> `'asking' | {name, description} | {why}` (`contacts.js:110`) and the
> `'asking'` state is rendered (`:679`), so cards already fill in as
> answers arrive. Under a cap of 1 that becomes visibly progressive
> rather than broken — fifty local contacts at ~3 ms serialise in under
> a fifth of a second; fifty remote ones at ~150 ms take seven, legibly.*

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

**`devicePeers` and `relayMonitor` were the only candidates for a
legitimate flow needing more than one request open. Both were resolved
2026-09-20, and they answered differently.**

**`relayMonitor` is a fixture.** `post(w, w.bella, w.owner, …)` runs at
lines 132, 147 and 172 and **nothing in the suite ever answers**, so
every post leaves a route open. Same shape as `routeHints`. Not evidence.

**`devicePeers` is real, and it is the relay-as-requester bottleneck.**
Two `deviceOffer` calls to two different members, back to back
(`devicePeers.js:134-135`). A device offer is the relay posting as
itself, so it opens its route under `mine.publicKey` (`relay.js:1575`) —
**two offers to two different people are two routes under one requester
identity**, and at a cap of 1 the second is refused.

That is not a test artefact and not a node holding two requests open. It
is the relay unable to do two unrelated things at once because its own
key is a single requester. **It confirms by production behaviour what
`routeHints` was wrongly credited with confirming.**

**So the node-side answer is: nothing in this tree needs more than one
request in flight per member.** Every failure that looked like node
concurrency was a fixture that never replies. The only genuine breakage
is relay-side, and the requester split fixes it.

## The plan, in the order the evidence dictates

1. **Split the requester classes.** Member, this relay forwarding, and
   inbound partner — three counts, not one. `caps: { memberPerMin,
   partnerPerMin }` is the precedent. Without this, nothing else can
   proceed.
2. **Cut `ROUTE_WAIT_MS`.** At cap 1 the timeout *is* the user's latency,
   and 15 s would make the cap look broken when the timeout is at fault.
3. **Record route lifetime.** The number is already in hand at close and
   discarded. Without it, every later argument about the cap is anecdote.
4. ~~**Resolve `devicePeers` and `relayMonitor`**~~ — **done
   2026-09-20.** `relayMonitor` is a fixture that never answers.
   `devicePeers` is real and is relay-side, not node-side: two device
   offers are two routes under `mine.publicKey`. Nothing in the tree
   needs more than one in flight *per member*.
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

## The whole thing collapses to one configured number

> **Andy:** *"for relay this means MAX_REQUESTS_IN_FLIGHT =
> MAX_MEMBER_ROLL_SIZE.... all equations simplified. many ceilings
> implicit constants."*

Almost exactly, with a factor of two: **a route has two ends and both are
capped.** A member may be a requester once and a target once, so the
worst case is `2 x members` — reached only when every conversation
crosses the relay boundary. Relay-local traffic shares a route (A to B is
one entry serving A's outbound slot and B's inbound), so the typical
figure is nearer `N`.

```
    10 members  ->     20 routes  =   0.3 MB
   100 members  ->    200 routes  =   3.1 MB
  1000 members  ->   2000 routes  =  31.3 MB
 10000 members  ->  20000 routes  = 312.5 MB

today: DEFAULT_MAX 256 slots = 4.0 MB, exhausted by SIXTEEN members
```

**Andy's thousand friends cost 31 MB.** That is the ambition costed:

> **Andy:** *"i might want a relay to provide 1000 friends with a fairly
> private/verified connectivity."* — cycle 4 blurb, `L2298`

**And the chain has one input.**

```
MAX_MEM  ->  member roll size  ->  routes in flight  ->  request RAM
```

Every ceiling below the first becomes derived rather than chosen.
`DEFAULT_MAX = 256` stops being a number somebody picked and becomes an
arithmetic consequence. The per-requester cap is the constant `1`, not a
tunable. The per-target cap is the constant `1`. What was four
independent numbers, none of them argued, becomes **one configured bound
and three constants**.

**One separation worth keeping straight:** the cap sets the **peak**, the
timeout sets the **turnover**. Peak RAM is `2N x PAYLOAD_MAX` whatever
`ROUTE_WAIT_MS` is — the timeout decides how fast a stuck slot frees and
therefore throughput under contention, not how much memory is held at
once. They are independent levers on the same resource and should not be
argued as one.

## Who the blockage falls on

> **Andy:** *"the member suffers from hanging requests. the blockage lies
> there. the system itself doesn't suffer."*

**Cap 1 converts a shared failure mode into a private one.** Today a
member holds up to sixteen of a 256-slot table that everyone shares, so
sixteen busy members can starve the seventeenth for something they did
not do. At a cap of 1 a member can only ever hurt **themselves**: a
hanging request blocks its owner's one slot and reaches nobody else.

That is isolation rather than fairness, and it is the stronger property.
Fairness divides a contended resource; isolation removes the contention.

**And it retires an assumption this note inherited.** Peak RAM is
`2N x PAYLOAD_MAX`, set by the caps and **independent of
`ROUTE_WAIT_MS`**. The timeout decides how long a *stuck* slot stays
stuck — the waiting member's experience, not the relay's exposure.

> **Andy:** *"timeout duration is a massive factor in the relay's memory
> usage."* — cycle 4 blurb, `L5413`

True at a cap of 16, where occupancy and the table ceiling interact.
**Superseded at a cap of 1**, where the caps bound the peak and the
timeout governs no memory they do not already bound. `ROUTE_WAIT_MS`
becomes a **latency** parameter and should be argued from human patience
rather than from RAM — which is a different argument, with different
evidence, and a ceiling this note is no longer entitled to derive from
the memory figures above.

**What survives of the RAM case for cutting it:** average occupancy, not
peak. A shorter timeout frees stuck slots sooner, so less of the
provisioned table is typically in use. That is an efficiency argument,
not a safety one, and it does not change what must be provisioned.

## The apps are the load generator, not the thing to fix

> **Andy:** *"if you fire all at once, the queuing and scheduling will be
> put to the test."*

**So no app changes.** `contactsAskEveryone` keeps firing one
`peerPost` per contact, all at once, and that is the fixture the
scheduler has to survive. Making the apps polite would be the wrong
repair twice over: every app would carry its own queue, each would do it
differently, and the transport would never be tested against anything
harder than well-behaved callers.

This is the one-door rule paying off. `peerPost` owns comms, so it
absorbs the burst and **no app needs to know a cap exists** — which is
also what makes the earlier guideline true rather than aspirational: *one
request at a time is what an app may assume*, and an app that assumes
otherwise is simply slower, not broken.

**The `infoDraw` repaint therefore drops out of the critical path.** It
remains worth doing — progress is more legible than silence — but it is
a nicety, not a prerequisite. `contacts.js` already renders its
`'asking'` state per card and needs nothing at all.

**The test does need more load, and load is not more nodes.**

> **Andy:** *"actually, the proof we're seeking right now doesn't require
> more nodes, massive load through one node will test the scheduler
> best."*

**Corrected in place.** This section first proposed a fatter world —
more peers, via `spirit/test/visual/*.visual.json`. That is the wrong
axis. **The scheduler lives in the requesting node**, so what has to be
overwhelmed is one node's queue, and adding peers adds relay work while
leaving queue depth where it was. Twenty real peers answering on loopback
in 3 ms would make the relay busier and the queue invisible — the
expensive fixture that tests less.

**What the fixture needs is depth, and targets that stall.** A peer that
answers immediately never produces either hazard `0016` names: no
head-of-line blocking, because nothing is ever at the head long enough;
no requeue, because nothing is refused. Both appear only against a target
that does not answer. So:

- **one node**, `contactsAskEveryone` firing its full width at once;
- **a long contact list** — rows, not processes, and therefore free;
- **most targets unreachable**, so refusal and backoff are the common
  case rather than the exception;
- **a few that answer**, so it is visible that a stalled target does not
  starve a reachable one. That is the head-of-line assertion, and it is
  the one that fails if dispatch walks a plain FIFO.

Three contacts against a live loopback relay — today's world — cannot
fail this test. It is not a weak fixture; it is a fixture with no
failing case at all.

### Two fixtures, and neither substitutes for the other

> **Andy:** *"two nodes overloading request to a third node will cover
> rejections by the relay."*

**One node cannot provoke the per-target cap at all.** With its own cap
of 1 it has one request outstanding, so it can never be the second
requester aimed at a target. Making the relay say *that target is busy*
takes two distinct requesters and one target — which is a second fixture,
not a bigger first one.

| fixture | who refuses | what it proves |
|---|---|---|
| one node, wide fan-out, stalling targets | nobody — requests **time out** | the node's own queue: cap of 1, per-target backoff, head-of-line |
| **two nodes -> one target** | **the relay**, per-target | the *not available* path, emitted rather than simulated |

**A timeout and a refusal are different paths in the node**, and that is
why the second fixture is load-bearing. One means *no answer ever came*;
the other means *the relay said no, try later, the target is fine*. They
want different responses: a timeout is evidence about the target, a
refusal is evidence about contention and must not poison a target's
backoff. Fixture one exercises only the first and would leave the second
proven by unit test alone — which is exactly how `routeHints` came to
assert against a fixture that never answers.

**Both are buildable against today's lab with no new machinery.**
`peer.post` is already a loopback verb (`server.js:1351` ->
`hub.handlePost`), taking `{to, text, via}`; `via` names the relay, so
the route is pinned rather than guessed. `labPopulate` already drives
peers exactly this way — through each peer's own node, *"the same route a
person uses"* — so the fixture is two un-awaited posts from two peers at
a third peer's key:

```js
postTo(peerB, { verb: 'peer.post', to: A.publicKey, via: relay.url, text: '…' });
postTo(peerC, { verb: 'peer.post', to: A.publicKey, via: relay.url, text: '…' });
```

**The fairness question falls out of this fixture and is not yet
answered:** at a per-target cap of 1 one of the two wins and the other is
refused. Whether the loser eventually gets through, or is beaten to the
slot every time by a requester that retries harder, is a starvation
question the backoff policy decides. Nothing in `0016` settles it.

## The scheduler: what is settled and what is not

> **Andy:** *"there's a lot to settle in the scheduler. the requeued
> request should be sorted by request-time, ascending."*

### Settled: a requeue keeps its original request time

**This is the anti-starvation rule, and it works inside one node.** A
refused request re-enters the queue with the time it was *first* asked,
so it sorts ahead of everything that arrived while it was being refused.
It ages toward the front rather than going to the back.

The alternative fails plainly: if a requeue took a fresh timestamp, a
node generating new work would starve its own retries indefinitely, and
the more useful the node the worse the effect. Original-time ordering
makes a refused request strictly more urgent over time, which is the
property wanted.

### It orders; it does not select

`0016` names head-of-line blocking as a hazard and says dispatch must
skip a backed-off target. **That is not in conflict with the sort — one
is the order, the other is the filter.** Stated together:

> **Oldest eligible first.** Walk the queue ascending by request time and
> dispatch the first entry whose target is not backed off and whose slot
> is free.

A plain FIFO that *stalls* on its head is what fails. Ordering by age is
correct; the fix for head-of-line is to keep walking, not to reorder.

### Ties are not an edge case — a burst is all ties

`contactsAskEveryone` fires N requests in one synchronous loop. **Every
one of them takes the same millisecond**, so `Date.now()` supplies no
order and the queue sorts nondeterministically — in whatever order the
sort happens to be stable or unstable for. The fixture designed above
produces this on its first run.

**A monotonic sequence number assigned at first enqueue** is the fix, and
it is the request time in the only sense the scheduler needs: it never
collides, and it never goes backwards — wall-clock does both (NTP steps,
DST, suspend/resume). A requeue carries its original sequence number
unchanged, which is the rule above, exactly.

### What this does NOT settle: starvation across nodes

The rule is local. It orders one node's own queue and says nothing about
two nodes contending for one target, because **neither node's ages are
visible to the other or to the relay.** When a slot frees, the relay
grants it to whoever asks next — so a requester that retries harder still
wins more often, and the two-node fixture will show exactly that.

Whether that matters is measurable rather than arguable, and the fixture
is the measurement. Three responses exist if it does, and they are not
equivalent: back-off jitter (cheapest, purely node-side), the relay
preferring a requester it just refused (costs the relay per-target
memory), or carrying the age on the wire so the relay can order by it
(costs a wire field and trusts the requester's clock). **None is chosen.**

### The timeout is the release, and that is what the ceiling argues from

> **Andy:** *"and the thing that lets other requests through is the
> timeout."*

**So the timeout is not a latency parameter at a cap of 1. It is the
queue's drain rate.** Nothing else frees a slot held by a target that
never answers, which means throughput against unresponsive targets is
exactly `1 / timeout`, and for a node facing N of them:

```
worst-case time to clear the queue  =  N x timeout
50 contacts x 15 s                  =  12.5 minutes
```

**This replaces the justification `0016` retired.** That decision states
plainly that the timeout ceiling has *"no evidence at all"* once the RAM
argument was withdrawn. It has one now, and it is a throughput argument
rather than a memory one: at a cap of 1, halving the timeout halves the
time a cold contact list takes to resolve. Andy's earlier *"i'd even set
a lower ceiling"* follows from this rather than from preference.

**It is still not a free dial.** Too short and a slow-but-live peer is
abandoned before it answers, converting a reachable contact into an
unreachable one — *reach over speed* pushing back in the other
direction. The ceiling is bounded below by real round-trip time to a
genuine peer, and that number has not been measured. But the trade is now
between two measurable things instead of one measurable thing and a
guess.

### The two timeouts already disagree, in this tree, today

| | value | file |
|---|---|---|
| node gives up | **8000 ms** | `peerPost.js:37`, `DEFAULT_WAIT_MS` |
| relay lets go | **15000 ms** | `relay.js:95`, `ROUTE_WAIT_MS` |

**The node abandons a request seven seconds before the relay releases the
route.** At a cap of 16 this is invisible. At a cap of 1 it is the
member's only slot, and the consequence is specific:

- the node's queue believes it drains at one per 8 s; it actually drains
  at one per 15 s, because **the longer timeout governs**;
- every request dispatched in the 7-second gap is refused — by the
  member's *own* abandoned route;
- those refusals are indistinguishable, at the node, from contention
  with another requester, so they feed the wrong backoff.

This is the hazard `0016` named as hypothetical. It is the current
configuration.

**Two repairs, and only one keeps the shorter node timeout:**

1. **Expose `cancel` to the member** and fire it on node-local timeout.
   `cancel` already exists in `router.js` and already enforces that only
   the opener may call it; nothing exposes it. This keeps the node's
   timeout meaningful and is the only option that lets the node drain
   faster than the relay.
2. **Make the node's timeout no shorter than the relay's.** Costs
   nothing to build and throws away the shorter timeout's entire benefit
   — the node would wait 15 s for a peer it gave up on at 8.

**The rule underneath both:** *a node must not treat a slot as free
before the relay does.* Recommended: (1).

### Replies are exempt by construction, and there is no lock

> **Andy:** *"there is a lock condition i worry about: the node responds
> to incoming (streamed) requests by posting the reply back..... are
> replies exempt from the 1 request cap? and how does that affect the
> memory math?"*

**The worry is the right shape and the answer is that a reply is not a
request**, so nothing has to be exempted:

| | request | reply |
|---|---|---|
| route | `/api/relay/post` | `/api/relay/reply` (`relayServer.js:537`) |
| effect on `pending` | **creates** a row | **deletes** one — `router.js:134`, `answer()` |
| delivery | relay holds it and waits | pushed down the requester's existing stream, `presentNow.send` |

**No deadlock.** The feared cycle is A posting to B while B is mid-post
to C: if B's reply needed a slot, B could not answer until C answered,
and at scale that closes into a ring. It does not arise. B's outbound
request occupies B's **requester** budget; A's request to B occupies B's
**target** budget; `0016` already separates them. B can always answer.

**On memory the reply is better than neutral: it is what frees the
row.** It is one of only two things that removes a `pending` entry, the
other being the timeout sweep. The reply payload is forwarded and not
stored, so it adds no row and no retained bytes.

### Correction: the reply is the normal release; the timeout is the fallback

The section above says *"the thing that lets other requests through is
the timeout"*, and that is true only of **stalled** requests. A healthy
request is released by its reply, in round-trip time. Stated as a drain
rate that matters:

```
50 contacts, all dead     50 x 15 s             = 12.5 min    worst case
50 contacts, 45 live      45 x 3 ms + 5 x 15 s  ~ 75 s        realistic
```

**Drain time is governed by the number of dead targets, not by the length
of the list.** The 12.5-minute figure is the worst case and was stated
above as though it were the case. The timeout ceiling argument survives —
it is still the only release for a dead target, and dead targets still
dominate — but the cost of a cold contact list is much smaller than that
arithmetic implied.

### The reply side inherits its bound from the per-target cap

The second half of the question — what stops a node firing an unbounded
number of outbound reply POSTs when many requests arrive at once — is
answered by a decision already made, doing a job it was not argued for:

**Per-target cap of 1 bounds arrivals, so it bounds replies.** A node can
hold at most one inbound request per relay, so a node connected to R
relays has at most R replies in flight. The reply side needs no cap of
its own.

Worth noting because it is load-bearing: **without the per-target cap,
the reply side is genuinely unbounded** — nothing in `answerCard` limits
concurrency, and it fires one outbound POST per arrival. The cap is what
makes that safe, which is one more reason it is the piece to build first.

### The memory math: 0016 costed the wrong thing

> **Andy:** *"so the memcap might have to consider members + (3 *
> request-size)?"*

**Two separate terms is the right shape, and checking it found the
decision's arithmetic to be wrong.** `0016` states peak RAM as
`2N x PAYLOAD_MAX` and prices 1000 members at 31 MB. **The relay does not
retain the payload.**

On a plain member-to-member route (`relay.js:3016`) `routes.open` is
called with **no `carry`**. The text lives in the `deliver` closure, is
pushed down the target's stream immediately, and the closure is not
stored in the entry — `pending[hash] = {requester, target, at, carry}`
and nothing else (`router.js:111`). `carry` is non-null only for a
partner forward, and there it holds a continuation and a key, never the
payload.

```
0016's claim   2N x PAYLOAD_MAX (16 KB)   1000 members = 31 MB
retained       2N x a few hundred bytes   1000 members = well under 1 MB
```

**The conclusion of `0016` survives; its arithmetic does not.** The thing
to bound is still concurrency, and the cap still bounds it — but the
route table is one or two orders of magnitude cheaper than the decision
claims, which makes the micro-relay argument *stronger* than it was sold.

**The payload cost is real and belongs to transit, not to lifetime.**
Roughly: inbound body buffer, parsed string, outbound frame. That is
where Andy's `3 x request-size` belongs, multiplied by *requests in
transit at one instant* — microseconds each — and not by members.

**Both threes are guesses and neither goes in a formula.** This tree
already has one placeholder that got used as a number —
`STREAMS_PER_MB = 16`, which `governor.js` marks as guessed in its own
comment — and a second would be worse than none.

**Both are cheaply measurable with apparatus that already exists.** The
Governor reads `heapUsed` every tick. Filling the route table to a known
depth and reading it back gives the retained row size directly; holding
known payloads in transit gives the multiplier. It is the same
measurement that would settle `STREAMS_PER_MB`, which `0016` already
names as **the highest-value measurement in the project**. That
assessment stands and this is a second reason for it.

### A reply is never subject to the request cap, and must never become so

> **Andy:** *"the request cap needs checking after the relay matches the
> hash to see if it's a reply."*

**Already true, by something stronger than ordering: they are different
endpoints.**

- `/api/relay/post` -> `routes.open()`, where `max` and `perRequester`
  are tested (`router.js:105-110`)
- `/api/relay/reply` -> `relay.routeReply()` -> `routes.answer()`
  (`relayServer.js:537`, `router.js:127`), which has **no cap in it at
  all**

The partner case holds too: a member answering a packet forwarded by a
partner returns through the `answerPartner` continuation carried in the
entry (`relay.js:3081`), not through a fresh `routes.open`. **No reply
path allocates a row or consults the cap.**

**Why this is written down rather than left as an observation.** The
property is currently an accident of having two routes. If those are ever
collapsed — one endpoint discriminated by whether the hash matches a
pending entry — then Andy's ordering becomes load-bearing and getting it
backwards produces the deadlock he asked about: a reply refused for
capacity, holding the slot it was about to free, on a table full of
requests waiting for replies. **The cap must be tested only after the
hash has failed to match.** A reply is a release, and a release is never
refused for lack of room.

### Also open in the scheduler

- **What a backoff period is**, and whether it grows. A fixed period
  synchronises retries across requesters; a growing one starves the
  patient in favour of the fresh.
- **Whether a timeout and a refusal back off the same way.** They should
  not: a timeout is evidence about the *target*, a refusal is evidence
  about *contention*. Treating a refusal as target trouble would poison a
  perfectly healthy target's backoff — and at a cap of 1 that is the
  member's only slot.
- **Queue depth, and what happens when it is reached.** Unbounded is a
  memory leak with a contact list behind it; bounded needs a policy for
  what is shed, and shedding the oldest would invert the rule above.
- **Whether the queue survives a restart.** It is node-local state with
  no persistence designed for it.


## If max_in_flight is a constant, connections may stop being a lever

> **Andy:** *"hmmm, if max_in_flight = const 1, then connections might
> become a computable constant, too."* — *"then connections will be
> derived from ram_available."*

**The derivation already exists.** `governor.js:69`:

```js
var ceiling = Math.max(FLOOR, Math.floor(ramLimitMB * perMB));
```

`connections1`'s **ceiling** is `ram_available x streams_per_mb` today.
What the lever does is move *below* that ceiling, in twelfths, when
`heapUsed` says the box is unhappy. So the computed constant is not a new
idea to build — it is there, and the lever is the hedge against it being
wrong.

**Which makes the real question: why is it still a dial? Two reasons, and
the ruling above retires one.**

1. **Per-member cost was not bounded.** Without a fixed `max_in_flight` a
   connected member could hold any number of routes at once, so no
   arithmetic from `ram_available` could hold — the ceiling was a guess
   about streams sitting on top of an unbounded term. A constant of 1
   bounds it: a connected member costs one stream and at most one route
   row.
2. **`STREAMS_PER_MB = 16` is a placeholder**, and `governor.js` says so
   itself: *"Guessed so the ceiling is finite and proportional to the
   configured bound; replaced by the per-stream cost cycle 1 measures."*

**So the lever now survives on the second reason alone.** That is a
narrower justification than it had this morning, and it is one
measurement away from none.

### Three roads to the same number

This is the third time in two days the same measurement has turned out to
be the blocker, which is itself the argument for taking it:

| asked | blocked on |
|---|---|
| what does a micro-relay cost to run? (`0016`) | per-stream cost |
| is "1000 members" defensible to an audience? | per-stream cost |
| must `connections` be governed, or computed? | per-stream cost |

`0016` already names it *"the highest-value measurement in the project"*.
Nothing since has weakened that and this strengthens it.

### What would remain even with the number measured

**An observer, probably — but governing something else.** A computed
ceiling assumes the cost per member is *stable*, and heap is not: GC
timing, payloads in transit, fragmentation and V8's own behaviour all
move it. A derivation can be right on average and wrong at a moment.

So the open question is not whether `connections` can be computed — it
can — but **whether the Governor still governs or only watches**:

- **Computed and governed**: `connections` is set from `ram_available` at
  boot and the Governor still sheds when observed heap disagrees with the
  arithmetic. The lever survives as a safety net, not as a policy.
- **Computed and watched**: the Governor reports, and a box that runs out
  of memory is a box that was configured wrong. Simpler, and it makes the
  arithmetic load-bearing in production rather than advisory.

**Not decided, and it should not be decided before the measurement** —
the answer depends on how much the measured cost varies, which is part of
what measuring it tells you.


## Live partners are bounded by members, outbound only

> **Andy:** *"another fallout will be max-live-partners = max_members,
> because there can only be one request in flight per member, that means
> there's an exact limit to how many partners must be live at the time to
> satisfy all flying requests from members."*

**The derivation holds. Two corrections to its statement.**

**It is `min(partner_roll, max_members)`, not `= max_members`.** A member
with one request in flight needs at most one partner live to carry it, so
the count of partners that must be live *at once* cannot exceed the count
of members who are asking. But it also cannot exceed the number of
partners there are: ten partners and five hundred members needs ten live,
not five hundred. It is a ceiling on simultaneous need, not a headcount.

**And it binds the OUTBOUND half only.** A partner dialling *us* is that
partner's decision, bounded by our partner roll and by nothing we control
— so the symmetric statement is false, and the gap is Andy's own red line:

> *"a large memory relay can overwhelm a small-RAM relay.... if all is
> programmed well, that's one of the biggest red-line risks i see"*

The inbound half is bounded by the **partner requester class** instead
(built 2026-09-20), which is a budget rather than a derivation. Two
different mechanisms for two different halves, and this insight supplies
only one of them.

### What it changes, because today there is no bound at all

`partnerLink.js:122`:

```js
start: function () {
  const list = relay.partners() || [];
  list.forEach(openTo);        // every partner, dialled, held
}
```

**Live partners is the whole partner roll, permanently, regardless of
members.** A partnership costs a relay two stream-equivalents — the one
it holds outbound and the one it serves inbound (`partnerLink.js`: *"One
each way... each carries the answers to the questions its holder asked"*)
— so five hundred partners is a thousand streams before a single member
connects. At the placeholder `STREAMS_PER_MB = 16` that is roughly 62 MB
of partner links on an idle box, and that figure inherits the placeholder's
uncertainty like every other one here.

### It supersedes a recorded stance, which is Andy's to confirm

`partnerLink.js:6` carries the opposite position, in his words:

> *"partners are the most permanent presences in practice: they are
> designed to run indefinitely, browsers are not."*

That is an argument about what a partner IS — a box that stays up — and
it is still true. What it was used for was holding every partner stream
open all the time, and the bound above says that is unnecessary for the
outbound half: a stream is needed when a member's request must cross, and
`min(roll, members)` is how many can be needed at once.

**The trade, stated so it is not decided by omission.** Dialling on
demand costs latency on first use of a cold partner, and *reach over
speed* has been read both ways here: keeping partners warm is reach, and
so is the extra membership the saved memory buys. Which dominates is a
question of how often a cold partner is the one a member wants —
unmeasured, and cheap to measure once the roll has more than two rows in
it.

**Not decided:** whether partner streams become on-demand, and if so
whether an idle one is dropped on a timer or kept until the memory is
wanted.


## The roll is sized by contacts; the live set by members

> **Andy:** *"our partner-requirements are not done yet. my statement was
> for outgoing requests, there might be attempts of partners not currently
> live (from the relay's POV), and we may have to examine dynamic partner
> off-on management I'm not really sure. because the contact list of my 10
> members may have peers from more than 200 relays..."*

**That is the number that breaks the symmetry, and it is an order of
magnitude out from the other one.** Ten members with a hundred contacts
each can span two hundred relays or more, while the simultaneous outbound
need stays at ten. The roll is driven by **contact diversity**; the live
set by **member concurrency**; and nothing ties them together.

**Two different costs, which is what makes the answer arithmetic rather
than taste:**

```
partner roll row     disc, a few hundred bytes    200 rows is nothing
live partner pair    RAM, two streams             200 pairs is the box
```

So **the roll stays large and the live set stays small**, and dynamic
on/off management is not optional — holding two hundred partnerships open
is four hundred streams to serve ten members' worth of concurrency. The
question was never whether to do it, only what the idle rule is.

**Dropping an idle OUTBOUND stream is safe, and `partnerLink.js` already
contains the reason:**

> *"the stream A holds to B is where B's answers to A land, and B's
> answers can only land there."*

So dropping our stream to B stops **us asking B**. It does not stop B
asking us, because that rides B's own stream to us. The cost of an idle
drop is latency on next use and nothing else — reachability inbound is
untouched. That asymmetry is what makes on-demand affordable, and it is
already designed in rather than needing to be added.

### What is genuinely not done: partner streams share the member allowance

`presence.js:145`, the admission rule for **every** stream:

```js
if (!old && !always && Object.keys(sinks).length >= allowed) {
  return { ok: false, status: 503, full: true };
}
```

**One allowance, one pool.** A partner dialling in is measured against the
same `allowed` as a member connecting, so two hundred partners arriving
can spend the room the members needed — and a relay with a large roll can
lock its own members out without anybody intending it.

**This is the requester-class split again, for a different resource.**
Routes were split into member / relay / partner budgets this morning on
the argument that they are three populations answering to three
arguments. Streams are the same three populations and have not been
split. The argument transfers exactly; the code does not, yet.

**It is also where the red line actually bites.** A large partner cannot
overwhelm a small relay through the route table any more — the partner
requester class bounds that. It can still do it through the stream pool,
because that is one number shared with the members it would be displacing.

**Not decided:**

- **The idle rule** for an outbound partner stream — dropped on a timer,
  or held until the memory is wanted. A timer is predictable; pressure is
  efficient. `0016` reasons that rolls need both an age bound and a space
  bound for the same reason, and this is the same shape.
- **How a partner stream pool is sized** against the member one. The
  outbound bound is derived (`min(roll, members)`); an inbound reservation
  is a budget and has to be argued, not computed.
- **Whether a cold partner's first use is visible** to the member who
  triggered it. At one request in flight, a dial plus a round trip is the
  member's only slot, and silence for that long is the case the UI
  guideline exists for.


## Could a partner connection's TTL be one request?

> **SUBSUMED the same day** by *"no streams between partners"* below. If
> there is no partner connection to hold, there is no TTL to choose, no
> refcount to keep and no grace period to tune. Kept because the reasoning
> is what led to the better answer: asking how short a connection's life
> could be is one question away from asking why it exists.

> **Andy:** *"another thing to examine: could TTL for a partner connection
> be 1 request...."*

**Yes, and the prize is not the memory — it is that the idle rule
disappears.** The section above leaves "timer or pressure" open and both
need a number nobody can derive. A lifetime of one request needs neither:
the connection lives exactly as long as the thing it exists for, and
`min(roll, members)` stops being a ceiling and becomes the actual count at
every instant.

That is a real simplification of the same kind `0016` is made of — a
tuned number replaced by a derived one.

### It cannot be literally one request, for two reasons

**The reply lands on that stream.** `partnerLink.js`: *"the stream A holds
to B is where B's answers to A land, and B's answers can only land
there."* So the lifetime is not "until sent" but **until answered or timed
out** — dropping at send loses the answer.

**And two members can cross the same partner at once.** The per-target cap
does not prevent it: member A asking peer X on relay R and member B asking
peer Y on R are different targets and both need R live. So the rule is a
**refcount** — drop when the LAST outstanding request through that partner
completes — which is still bounded by members and still needs no timer.

### What it actually trades, which is not RAM for latency

**It converts a RAM cost into a CPU and rate-limit cost**, and on a
micro-relay those may be the scarcer ones:

- **Each dial is a handshake.** Reached over TLS, which production is, that
  is asymmetric crypto per connection — the expensive kind — where a held
  stream pays it once. Unmeasured here, and it is the sort of thing a
  small box notices before it notices 64 KB.
- **Each dial is an admission at the partner**, counted against their
  `partnerPerMin` (`relay.js:283`, reported in `caps`). Churn spends a
  budget that already exists and was sized for requests, not for
  connections. A relay that reconnects per request could rate-limit
  itself out of a partner it is entitled to talk to.

So the honest statement is that this does not simply save memory; it moves
the cost to two places that are already metered and one that is not
measured at all.

### Whether it is a good trade turns on locality, and the evidence cuts both ways

**Against warmth:** the contact-diversity number. Two hundred relays for
ten members means a member's consecutive requests probably go to
*different* partners, so a held stream is usually the wrong one held. That
argues for the shortest possible life.

**For warmth:** the bursts this cycle is built around. `contactsAskEveryone`
fires a member's whole contact list at once, and at one request in flight
those serialise — so the same handful of partners are wanted repeatedly
over a few seconds, and then not at all. Instant drop pays a handshake per
contact; a few seconds of grace pays one per partner per burst.

**So the shape the evidence points at is refcount plus a short grace**,
where the grace exists to catch a burst rather than to keep anything warm.
It is a timer, which this idea was attractive for avoiding — but a small
one bounded by burst length rather than a tuned idle period, and the
refcount is what keeps the bound exact.

**Not decided, and the measurement that would decide it:** the handshake
cost against a real partner over TLS, beside the per-stream RAM cost.
Those two numbers pick the answer, and the second is the measurement three
other open questions already wait on.


## No streams between partners

> **Andy:** *"ie. no streams between partners."* — *"lets face it: the
> only thing streamed between partners are responses."*

**Checked, and true — but this first rested it on the wrong fact, and
Andy corrected that in the same sitting.**

> **Andy:** *"A partner is the target during the partnering cycle."* —
> *"but same thing. only request/response."*

**The claim as first written:** every `'request'` a relay pushes down a
stream targets a MEMBER (`relay.js:1604` `post()`, `1995`
`forwardToMine()`, `3053` `routePost()`), and a partner can never BE a
target, because `routePost` refuses it — *"A PARTNER MAY ONLY ADDRESS
THIS BOX"*, 403.

**That is true of this tree and it is the wrong thing to rest on**, because
it is true only for as long as acquisition is unbuilt. Partner acquisition
is cycle 5 (`relay.js:3003`, `relayStore.js:24`), and when it lands the
partner IS the target — so the premise would have expired exactly when the
design depending on it was being built.

**The durable premise is Andy's: every partner exchange is
request/response.** A forward, a search, and an acquisition handshake are
all one question and one answer between two boxes that both have public
addresses. That is a property of the protocol rather than of the schedule,
it covers cycle 5 in advance, and it is what the conclusion actually needs.

So: **a partner stream carries replies and nothing else** — and it need not
carry those either, for the reason below.

### And the tree already answers a partner without one

This is the part that makes it a simplification rather than a proposal.
There are **two mechanisms doing one job** today:

| a partner's question | how it is answered |
|---|---|
| a **forward** (`forwardToMine`) | the partner's own HTTP response, **held open** and resolved by the `answerPartner` continuation carried in the route entry |
| a **search** (`routePost` -> `answerSelf`) | `presentNow.send(requester, 'reply', ...)`, down a stream |

The first needs no stream and is already in production. The second is why
`partnerLink` exists. Unifying on the first is what *"no streams between
partners"* means, and it removes a mechanism rather than adding one.

**The objection on the record is about implementation, not necessity.**
`partnerLink.js` says: *"A relay has a public address, so it looks as
though one socket would do. It would not, because of what the stream IS in
this system — the INBOUND HALF of the one interface. A reply leaves a
relay through `presentNow.send`, down a stream the asker holds."* That is
true of a NODE, which has no address to be reached at. It is not true of a
relay, and the reply-by-post path already exists: a node answering a card
does exactly this, `POST /api/relay/reply` (`peerPost.answerCard`).

### What it removes

- **The whole partner stream pool.** The gap found above —
  `presence.js:145` measuring partner streams against the same `allowed`
  as members — closes by **deletion rather than by a budget**. Nothing to
  size, nothing to reserve, nothing to argue.
- **The red line's remaining path.** A large partner could still overwhelm
  a small relay through the shared stream pool. With no partner streams
  there is no pool to overwhelm; what is left is posts, which are already
  rate-gated (`partnerPerMin`) and route-capped (partner requester class).
- **`partnerLink.js` very largely** — dial-at-boot, backoff, the idle
  watchdog, reconnect.
- **Every open question in the two sections above**: the idle rule, timer
  versus pressure, one-request TTL, refcounting, the grace period. None of
  them exist if there is no connection to manage.
- **`min(roll, members)` as a thing to enforce.** It stops being a bound
  to implement and becomes a description of how many posts may be in
  flight, which the per-member cap already bounds.

### What it costs, stated so it is not decided by omission

- **A held-open HTTP response is not free.** It is a socket for the
  duration of the request, so this trades a socket-per-partnership for a
  socket-per-in-flight-request. That is the right direction only because
  in-flight requests are capped and partnerships are not — the roll is
  sized by contact diversity (200+), the in-flight count by members (10).
- **Liveness stops being known.** A held stream is how a relay knows a
  partner is up; `partnerFromHints` picks among partners it believes live.
  Without streams that becomes try-and-find-out, which costs a round trip
  against a dead partner where today it costs nothing. `0006`'s *"deliver
  or refuse, refuse instantly"* is a member rule and does not carry over
  for free.
- **Warmth moves to the transport, which is where it belongs.** Repeated
  posts to the same partner reuse a socket through ordinary HTTP
  keep-alive, so locality is had without a stream abstraction, an idle
  rule or a refcount. That is the whole preceding analysis, obtained by
  not writing it.

**Not decided:** whether partner liveness needs any replacement at all, or
whether a failed post IS the liveness signal. That is the only question
this raises that the tree does not already answer.


## Foreign presence: what is actually lost

> **Andy:** *"we loose presence for foreign peers."*

**The sharpest cost named so far, and checking it turned up two things
that were not expected.**

### It does not work today

`partnerLink.js:105` takes `request` and `reply` and drops everything
else on the floor — *"A partner's roster is not this relay's to hold,
even in RAM, even briefly."* Nothing consumes a `presence` or `roster`
event arriving from a partner.

So a foreign contact is **already permanently white** in `PRESENCE.md`'s
colour model: known to you, named by no relay you are connected to.
Never green, never red. The partner stream was the **reserved path** for
foreign presence, not a working one — so what is lost is a capability
that was planned, not one in use.

**That matters for the decision.** Removing something unbuilt costs a
future, and futures are cheaper to change than working code. It does not
make the cost zero.

### But the sending half is live, and it is a leak

`presence.js:215`:

```js
function broadcast(event, data) {
  Object.keys(sinks).forEach(function (id) { write(sinks[id], event, data); });
}
```

**Unfiltered — every sink.** And partners ARE sinks, because
`partnersNow` was never built and a partner's stream enters `presentNow`
(`relay.js:406`, one registry). So this relay already announces **every
member's arrival and departure to every partner relay**, continuously.

Nothing asked for it and nothing needs it. It is discarded at the far end
only because `partnerLink` chooses not to handle it — **the receiver's
politeness, not the sender's design**, and a partner running different
code keeps the lot. `PARTNERS.md`'s hard rule that a relay never persists
a partner's members guards the wrong end: the bytes are handed over
unasked.

**So removing partner streams closes a leak as well as costing a
capability**, and the leak is real today while the capability is not.

### If foreign presence is wanted later, without streams

Three shapes, and they are not equivalent:

- **Learn by trying.** A post to a foreign peer already answers
  *delivered* or *peer not reachable* — that IS presence, discovered at
  the moment it matters and for the peer it matters about. `0006`'s
  *"deliver or refuse, refuse instantly"* is already this. Costs nothing
  extra and tells you about one peer, when asked.
- **Ask on demand.** A presence query to the partner, request/response.
  Precise, but at one request in flight it spends the member's only slot
  on a question about somebody they have not written to yet.
- **Poll a census.** Cheap to build and the thing `EVENT-STREAM.md`
  exists to have killed — *"the node already calls the relay 30 times a
  minute"*. Not seriously on the table.

**The first is the one that fits the constraint**, and it changes what
the UI can promise rather than what it can do: a foreign contact has no
colour until you reach for them, and then the answer is immediate and
true.

### And a fourth, which the tree already decided

> **Andy:** *"hmmm successful search = presence."*

**Exact, and it is not a new idea — it is a decision from 2026-09-19 whose
consequence here had not been noticed.** `peerSearch.js:58`:

> *"`present` STOOD HERE, a quarter of the match: 'is there anybody
> there'. Moot since 2026-09-19 — a relay answers a search from its
> connected members only (Andy: 'search should respond with active/online
> members only'), so every row offered is present and the signal told
> nothing apart."*

> **Andy, scoping it:** *"B can only answer with present B-members"* —
> *"in a search"*.

**In a search, and that qualifier is load-bearing.** A relay answers a
**search** from its connected members only, so every row in a search
answer is, by construction, a present peer — and the `present` signal was
**deleted from the ranking** because search had absorbed it.

It does not generalise to partner traffic as such, and this first said it
did. **What each partner exchange tells you about presence is different:**

| exchange | what it asserts |
|---|---|
| **search** | an enumeration: *these members of mine are present now* |
| **forward** | one peer, and only by refusal — an absent target is 503 *"peer not reachable"* (`relay.js:1968`) before the packet goes anywhere |
| **acquisition** (cycle 5) | nothing about members at all |

So a search **enumerates** present peers; a forward **tests** one. Both
carry presence, and only the first discovers it. The discovery path is
therefore the one that matters here, and it already carries what the
partner stream was reserved to carry.

**So foreign presence is not lost with the streams. It arrives with the
peer.** You learn of a foreign peer by finding them, and finding them is
the evidence.

**The qualifier, stated so the equation is not read as more than it is:**
a search gives presence **at a point in time**; a stream would give
**transitions**. The snapshot is true when it is taken and begins ageing
immediately. That is the whole difference, and it decides the remaining
question rather than leaving it open:

- **"Can I reach this person now?"** — the snapshot at the moment of
  asking is exactly right, and *learn by trying* makes it exact.
- **"Show me who is online, continuously"** — a snapshot cannot do that
  for a foreign peer. It would go stale without saying so, which is worse
  than white.

### Decided: search is incomplete, and that is accepted

> **Andy:** *"so we have incomplete info in search. we have to live with
> it."*

**What is incomplete, precisely:** a relay answers a search from its
connected members only, so **an offline peer cannot be discovered at
all**. Not ranked low — absent. Somebody asleep is, to a stranger
searching for them, indistinguishable from somebody who does not exist.

**Decided by Andy on 2026-09-21: this is accepted, not a defect.** It is
recorded here with its bound so that a later session does not read it as
a bug and "fix" it by holding a partner's roster — which
`PARTNERS.md`'s hard rule forbids, and which is the thing this whole
design is avoiding.

**Three things bound the cost, and together they make it small:**

- **It is discovery-time only.** Once acquired, a contact row carries the
  key and the route hints and is permanent. You can never *lose* somebody
  by their going offline; you can only fail to *meet* them.
- **Search is one acquisition route of six.** `contacts.js:94` —
  `['message', 'invite', 'handle', 'member']` are listening routes beside
  `census` and `hold`, and **`handle` and `invite` do not need the peer
  present at all**. The presence-dependent path is one of several, and
  not the one a person uses when they already know who they are looking
  for.
- **It is retryable and costs nothing to retry.** Searching again later
  is a post, and the peer being online is exactly the condition under
  which finding them is useful.

**So the honest statement of the limitation is narrow:** you cannot
discover a stranger who is offline, by search, at that moment. Everything
else about reaching them is unaffected.

### A post confirms presence, and the probe already exists

> **Andy:** *"A simple post from N1 to B could confirm presence...."*

**Yes, and nothing needs building.** A post to a foreign peer answers
*delivered* or 503 *"peer not reachable"* (`relay.js:1968`), so the
attempt is the answer. `ROUTER-PACKETS.md` already names the shape — *"a
ping is the whole mechanism with the payload taken out"* — and there is
no separate verb because there need not be: `contacts.js` sends
`peerPost('', key, { describe: true })`, a minimal post whose reply
proves the peer is there and hands back their card as well.

**So presence-on-demand is a solved problem** and the remaining question
is only when it is worth spending.

**The cost is one in-flight slot and one round trip**, which at a ceiling
of 1 is *the member's only slot*. That makes the rule sharp:

- **Probing ONE peer, at the moment it matters, is free in practice** —
  the post you were going to send is the probe. Nothing is spent that was
  not being spent.
- **Sweeping a list is N round trips, serialised.** Fifty contacts at
  ~150 ms remote is seven seconds of a member's entire outbound capacity
  spent on colouring a screen nobody has acted on yet.

`contactsAskEveryone` is exactly that sweep, and it is the load generator
this cycle's scheduler is being written against.

### The queue makes the sweep survivable — and exposes a gap

> **Andy:** *"and since the node buffers/queues requests, it just might
> take a little longer."*

**Correct, and it weakens the guidance above rather than confirming it.**
Nothing fails: the queue absorbs the burst, and `contacts.js` already
renders each card's `'asking'` state (`contacts.js:110`, drawn at `:679`),
so a sweep *fills in* rather than hanging. That is *reach over speed*
working as intended — the sweep is slower, not lost.

**But set that beside the ordering rule and a gap appears that neither
rule has alone.**

Requests sort by original request time, ascending — which is the
anti-starvation rule and is right. Now:

```
T0    contactsAskEveryone enqueues 50 probes
T1    the person types a message and sends it
```

At `T1 > T0`, their **deliberate act sorts behind all fifty**, because a
background sweep started first. At a ceiling of 1 that is seven seconds
of waiting to send a message, caused entirely by a screen decorating
itself.

**Age ordering is fair; it is not priority.** Fairness is the right answer
*within* a class — it stops a refused request being starved by newer ones.
It is the wrong answer *between* classes, because it ranks a cosmetic
request above a person's intention purely on arrival order.

**Three ways out, and they are not equivalent:**

- **Don't sweep.** The guidance above. Cheapest, and it gives up
  pre-filled cards.
- **Two classes, deliberate and background**, each ordered by age within
  itself and deliberate served first. Small, and it is the same
  population argument that split the requester classes on the relay: a
  person acting and a screen decorating are not one queue.
- **Let a deliberate request displace a background one** already in
  flight — needs `cancel`, which is already required for the timeout
  hazard, so it may be nearly free.

**Not decided.** But the second is the one that lets Andy's *"fire all at
once"* and his *"oldest first"* both stay true without a person ever
waiting on a decoration.

**Still not decided, and now the only open piece:** whether a foreign
contact needs a live colour, or whether truth at the moment you reach for
them is the promise. The probe above makes the second cheap and the first
expensive, which is an argument but not a decision. `PRESENCE.md` §4 made white mean *"named by no relay
you are connected to"*, which is literally correct for a foreign peer —
the colour model already says this, and the partner stream was going to
make it lie. A search result could legitimately colour a foreign row
green **with an age on it**, which is a third state the model does not
have.


## The node's patience is the user's, and it may be days

> **Andy:** *"the node will allow the user to configure timeout (max time
> spent in request-scheduler before returning failure.... (could be days
> for a text message...)"*

**This reframes the queue.** A queued request stops being a transient
waiting for a slot and becomes a **durable intent**: *deliver this to
Bella, keep trying for three days.*

### It does not contradict the revocation — it draws the line

This morning the owner's grant over relay limits was revoked: *"a limit
an owner can widen is not a limit, it is a default."* This hands a
timeout to a user. The two are consistent, and the rule that makes them
so is worth stating:

> **The relay's limits are the design's. The node's patience is the
> user's.**

A relay limit holds the arithmetic together for everybody on the box and
for its partners — widening it breaks a guarantee other people depend on.
A node's willingness to keep trying **affects only the person who set
it**: a longer patience spends that member's own slot and nobody else's,
and it cannot raise what the relay will accept. Same argument, opposite
answer, because the blast radius differs.

### Two timeouts, and they are not the same number

Naming this carefully, because `0016` already has one timeout discussion
and this is a different one:

| | what it bounds | whose |
|---|---|---|
| `ROUTE_WAIT_MS` (15 s, `relay.js:95`) | one **attempt** — how long a relay holds a route | the relay's |
| node-local per-attempt wait (8 s, `peerPost.js:37`) | one **attempt**, from the node's side | must not be shorter than the relay's, or `cancel` is required |
| **scheduler patience** (new, days) | the **whole intent**, across many attempts | the user's |

So a three-day patience is not a three-day request. It is many attempts,
each bounded by the relay, until one lands or the patience runs out.

### What it answers

- **The queue must survive a restart.** Left open above as *"node-local
  state with no persistence designed for it"*. Days means restarts, so
  the answer is yes and the queue needs a store. `relay-state/relay.db`
  is the precedent for a node-side persist shape that a cycle opened
  deliberately.
- **Backoff must grow.** Also left open. Retrying every 15 s for three
  days is 17,280 attempts at one peer — so patience measured in days
  forces a growing interval rather than merely permitting one.

### What it changes for the product

**Absence stops being a failure and becomes a delay.** You do not need a
peer present in order to send to them: the intent is queued and delivered
when they appear. That closes the gap left by *"search is incomplete"*
from the other side — you still cannot **discover** an absent stranger,
but you can always **write** to somebody you already hold.

**And it settles where mail lives.** R8 decided a relay keeps no mail —
*"a packet exists only while somebody is connected to receive it"*. This
says the **sender's node** holds it until delivered. Store and forward,
at the edge, owned by the person who wrote the message rather than by a
box in the middle. That is the same answer `0013` and *reach over speed*
keep giving, and it is what makes a relay that stores nothing a complete
design rather than a limitation.

### Whose problem it is, which is an existing principle

> **Andy:** *"... node's problem."*

**`THE-REQUESTER-IS-RESPONSIBLE.md` already decides this**, and it is a
case that file does not name — it says so itself: *"it decides cases
those do not name."*

The principle is stated about **imprecision**: *"the burden of
specificity sits on the party asking... a relay is not obliged to
compensate for a poor question by spending more."* This extends it to
**persistence**, unchanged in form:

> **Whoever wants the thing delivered carries the cost of wanting it.**

The relay owes one attempt and forgets — fifteen seconds, a route entry
of four small fields, gone whether it succeeded or not. The node that
wants Bella to receive the message carries it for three days: the queue,
the store, the backoff, the retry, and the telling-somebody when it
finally gives up. **None of that appears on the relay**, and that is the
whole reason a relay's memory can be a function of its membership rather
than of how patient its members are.

**It also names what NOT to build.** Every mechanism this cycle has been
tempted by — a relay remembering a failed delivery, holding mail, pacing
retries on a member's behalf, knowing which partners are live — is the
relay compensating for a requester's need. Each was rejected separately
today on its own evidence; they were one rejection all along.

### What it opens

**Queue depth now matters much more.** Entries that live for days
accumulate, and the shed policy left open above ("unbounded is a memory
leak with a contact list behind it") becomes a real question rather than
a precaution. The class split proposed above helps — shed background
before deliberate — but a bound is still needed.

**And the failure, when patience does run out, is now a real event.**
A request that has been trying for three days and gives up must tell
somebody, and there is no UI for that today.


## With no partner streams, the disc limit for partners is the only limit

> **Andy:** *"so the disc-space limit for partners is real."*

**Yes — and it inverts what `0016` worried about.** That decision noted a
space bound *"fails to evict stale members if there's too much disc space
available"*: disc is so cheap that a limit made of it barely binds.

For partners that was fine, because disc was never the binding cost — two
held streams were. **Remove the streams and disc is all that is left**, so
the limit becomes real in the sense of being the *only* one, and loose in
the sense of hardly constraining anything: a partner row is `relayKey,
url, ownerKey, status, since` (`relayStore.js:103`), a few hundred bytes.
A hundred thousand partnerships is around 19 MB.

**A roll that large is the problem, not the prize.**

### Because liveness went with the streams

`relay.js:2698` records what a dead partner costs and how it was fixed:

> *"LIVE PARTNERS ONLY. A partner is live when it holds its stream here
> now — the test hint routing uses. **Asking one that is down held every
> search for the full timeout** (the answer waits on all of them)."*

`presentNow.isPresent(p.relayKey)` is that filter, and it is exactly what
*"no streams between partners"* deletes. So:

- **nothing prunes the roll** — a partner that died is never noticed,
  because noticing was the stream closing;
- **every search pays for it** — the roll grows, the dead fraction grows
  with it, and each dead row is a full timeout on a question a member is
  waiting for;
- **and the disc bound does not help**, because it binds at a hundred
  thousand rows and the search is unusable long before that.

**So a space bound alone leaves the roll frozen and the searches slow** —
which is the same failure `0016` named for the member roll, arriving by a
different road.

### The replacement is a timestamp Andy already asked for

> **Andy, earlier:** *"partner rows must have a timestamp for
> last-successful transmission."*

**Not built.** The schema has `since` — when the partnership began — and
nothing about when it last worked (`relayStore.js:107`).

That field now does two jobs, and it is the answer to the open question
*"does partner liveness need a replacement"*:

- **Staleness eviction.** A partner that has not answered in N days is
  evicted, which is the age bound `0016` requires beside the space bound.
  The signal is a failed post, which costs nothing extra because the post
  was being made anyway.
- **Search ordering, replacing `isPresent`.** Ask the recently-successful
  partners first, and a long-silent one last or not at all. Weaker than a
  held stream — it is evidence about the past rather than the present —
  but it degrades in the right direction, and *"successful search =
  presence"* means a successful ask refreshes it for free.

### Corrected the same day: do not evict for silence

> **Andy:** *"but the partner roll is what supplies connectivity."*

**This section proposed staleness eviction for partners, and that is
wrong.** It trades reach for speed, which is the standing ordering
backwards (`0007`: *survive > reach > speed*). The justification was
search latency — a speed problem — and the remedy was to destroy reach.

**Silent is not dead**, and the section ran the two together. A partner
nobody has had occasion to ask in three months is not stale; it is
*unused*. It still supplies a door to another relay's entire membership,
and it costs a few hundred bytes to keep. **The roll IS the
connectivity** — that is what a partnership is for — so shrinking it to
make a query faster is spending the asset to reduce a cost of using it.

**The right fix is to bound the QUERY, not the roll.** The problem was
that a search asks every partner and waits on the dead ones. So ask
fewer: order by `last` and ask the recently-successful first, with a
bound on how many. The roll stays as large as disc allows; the search
touches a working subset.

**Which is already half-built.** A search fans out as this relay posting
to partners — **relay-class requests** — so the number in flight is
already bounded by the relay requester class (built 2026-09-20). The
fan-out cannot be unbounded even if the roll is.

### So the column stays; only its second job goes

`last` beside `since` is still the answer to *"does partner liveness need
a replacement"* — but it **orders** rather than **evicts**:

- **Search ordering, replacing `isPresent`.** Recently-successful
  partners first, long-silent ones last or not at all. Evidence about the
  past rather than the present, but it degrades in the right direction,
  and *"successful search = presence"* refreshes it for free.
- **NOT staleness eviction.** A partner leaves when the owner removes it,
  or under genuine disc pressure — the space bound, applied as a space
  bound. Not for being quiet.

**This is where partners and members differ**, and `0016`'s *"similar for
partners"* does not carry over. A member roll holds people who expect to
be served and whose seats are finite; an idle member occupies a seat
somebody else wants. A partner roll holds **doors**, which cost disc and
nothing else and which take nothing from anybody by existing. The age
bound was argued for seats. Doors are not seats.

**Not decided:** how many partners a search asks, and whether a partner
that has failed for a very long time is ever forgotten or merely sorted
last for ever.


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
