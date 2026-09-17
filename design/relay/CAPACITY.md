# A relay governs itself by what it can observe

**First cut, 2026-09-17. Nothing here is built.** Every claim about the tree
was checked at `97e973e`. This is written to be argued with: *decided*,
*recommended* and *open* are kept apart, and the one measurement that
surprised its author is called out rather than buried.

> **Andy:** *"a relay's capacity is primarily governed by its own RAM and
> by its network bandwidth."*

That sentence is the whole document. Everything below is what follows from
taking it literally: if capacity is RAM and bandwidth, then a relay can
*measure* its own capacity, and a limit it measured is worth more than a
limit somebody typed.

---

## Why this is live now

Two things arrived together.

**The conduit decision** (PARTNERS.md, *"acquisition is the gate"*): relays
forward across a partnership and the recipient node gates by identity. That
widens the population who may knock at a node's door from *members of my
relays* to *members of my relays ∪ their partners' members*.

**And a cost this author overstated.** That section said the relay's
concern "moves from consent to abuse" and owes a rate story. Andy:

> *"spam and abuse can also happen between two peers on the same
> relay-ledger."*

Correct, and it makes the point sharper than it was. The node-side floor is
already global rather than per-sender — `unknownBytes` is **one array
summed across everybody** ([peerPost.js:143](../../spirit/run/js/peerPost.js#L143))
— so the ceiling on what strangers can make a node write **does not move
when the stranger population grows**. Ten thousand partner-members share
the same 64 KB/min that two do. Widening reach cannot touch that number.

So this is not a debt the conduit decision created. It is a gap that was
always there, and the conduit decision is only what made it worth looking
at.

---

## What is actually there today

Measured by reading, at `97e973e`.

| guard | value | where | scope |
|---|---|---|---|
| claim attempts | 10/min per caller | `relay.js:769` | per relay |
| device enrolment | 10/min per identity, **named in the refusal** | `relay.js:1189` | per relay |
| payload size | `PAYLOAD_MAX` 16384 | `limits.js` | per packet |
| unknown sender, requests | 6/min **per stranger** | `peerPost.js` | per node |
| unknown sender, payload | 65536/min **across all strangers** | `peerPost.js` | per node |

### The finding: there is no rate limit on posting

`rateOk` has exactly **two** call sites — claim and device enrolment.
`routePost` has none. A member may post as fast as they can open sockets,
and the only thing bounding it is the destination node's floor, which
applies **only to senders it has never heard of**. Between two acquainted
peers there is no rate limit anywhere in the system.

The "30 sends per minute per key" that reads like a live rule
([relay.js:259](../../spirit/run/js/relay.js#L259)) is a comment about
`send`, the ring route R8 deleted. The reasoning in it is worth keeping —
*"keying on the claimed name made the limit meaningless: 30 per minute per
made-up string, and rotating the string resets the budget"* — but the limit
it describes does not exist any more.

**So this proposal is not tightening anything. It is the first relay-side
limit on the thing that moves bytes.**

### And what the relay already knows about itself

`relayStatus.report` already carries `routes` — *"posts registered and not
yet answered … the number that says whether this relay is BUSY as opposed
to merely populated"* — and `memory.rss`, with the note that **rss is the
honest figure** because heapUsed flatters on a box that is mostly sockets.

Both are already streamed to the owner. Nothing new has to be measured to
start.

---

## Decided (Andy)

1. **A rate limit is not a constant.**

   > *"fixing a limit as a constant seems… not very modern."*

2. **It is a division of capacity by the load on it.**

   > *"rate limits should be relay-capacity / live-nodes-at-the-time."*

3. **Capacity means RAM and bandwidth**, and nothing else is primary.

4. **The current value is streamed.**

   > *"the current rate-limit is streamed to partners and members at
   > reasonable intervals."*

5. **Bandwidth is observed, not declared** — up and down, in a ring of
   recent measurements.

   > *"bandwidth upstream and downstream could be measured and observed in
   > a ring-bucket of current measurements."*

---

## Recommended (Claude), not decided

### 1. Two units are two limits, not one number

RAM and bandwidth bound different things and cannot be collapsed:

| | is a | spent by | bounded figure |
|---|---|---|---|
| **RAM** | stock | what is *outstanding* — routes in flight, held sinks, rate buckets | concurrent routes per member |
| **bandwidth** | flow | bytes moved | bytes/min per member |

Ten thousand posts a minute that all complete cost almost no RAM. A hundred
that hang cost more. A single sends/min figure governs neither well, which
is why `routes` — already reported — is the RAM-side number and a byte
count is the bandwidth-side one.

### 2. Throughput is not capacity: the ring needs a saturation signal

A ring of byte counts records what the box *did*, not what it *could*. Low
numbers are ambiguous between "plenty of headroom" and "tiny pipe, nobody
tried", and no amount of counting bytes separates them.

So each slot should carry a symptom beside the count — write latency, or
send-queue depth:

```
throughput rising,  latency flat      →  headroom; raise the published number
throughput plateaus, latency climbing →  the ceiling, found without configuring it
```

That is the honest definition of capacity: **the highest throughput observed
while the box still felt fine.** Discovered, never declared — which is what
makes it "modern" in the sense Andy meant, rather than a constant with a
formula wrapped round it.

### 3. The discovered peak decays

A relay that managed 50 Mbit at 03:00 on an idle link must not assume it at
21:00 on a contended one. Use a **windowed max** — best in the last N
buckets, not best ever — which the ring already gives for free.

A property worth liking falls out: a fresh relay **starts conservative and
earns its ceiling** by watching itself succeed. Safe by default, nothing
configured, improves with evidence.

### 4. Aggregate only. Never per-peer.

The ring is one structure for the box, two directions. The same ring kept
*per member* would be a record of who talks how much and when — precisely
what this system refuses to hold — and it would arrive **by the side door**,
as a performance feature, in a file nobody thinks of as a ledger.

The precedent is already written, for the route-usage counter:

> *"in memory is the whole point: it resets on restart, it is never served,
> and it describes the relay's own work rather than anybody's traffic. A
> counter that survived a reboot would be a record of who talks to whom,
> which is precisely what this system does not keep."*

One ring, two directions, each slot `{bytes, elapsed, latency}`. Enough to
govern; not enough to reconstruct anybody's behaviour.

### 5. A floor, expressed as work rather than as a number

Pure division has a failure mode: under load everyone converges on nearly
zero, including the packet that would say *"I am being starved."* A
guarantee is what makes the dynamic part safe to be **aggressive** — if
nobody can be starved, the shared portion may swing hard.

But it should not be written as a constant. Write it as a requirement in
units of work:

> **One greeting and a handful of replies per minute must always get
> through.**

Then it is derived from the smallest useful thing a person can do, and it
has an honest failure mode: a relay too loaded to honour it should **stop
accepting new members and say so**, rather than silently starving the ones
it has.

The streamed number is then the **burst above the guarantee**, and it is
free to move because nothing depends on it holding still.

### 6. The published value is in force until superseded

This is what removes flapping, and it needs no damping function. If the
number a relay streams is the number it has **committed to for that
interval**, the value cannot move between announcements. Hysteresis stops
being a tuning constant and becomes a property of the protocol.

### 7. The refusal names it — and there is a precedent

> *"It is NAMED in the refusal — the one thing this route ever says
> precisely — because it is temporary and a page that knows it is
> rate-limited waits rather than gives up. Everything else gets `not now`."*
> — [relay.js:83](../../spirit/run/js/relay.js#L83)

So a member holding a stale value self-corrects on refusal, and the stream
is the fast path rather than the only path. **Nothing has to be reliable.**

### 8. The real payoff is partner-side backpressure

A partner that knows B's current budget can slow down or refuse **locally**
instead of forwarding into a wall and learning by 429. That converts abuse
control from *"refuse at the destination"* into *"do not send"* — which is
what keeps `partners × members` from being a flood, and it is not available
at all without the streamed value.

### 9. `limits.js` is not a rate limit and should stop being filed as one

`PAYLOAD_MAX` is a **format** constant: both ends must agree statically or
the client's pre-check breaks (*"a cap the client pre-checks must be the
cap"*). It is grouped with rate limits because it lives in the same
sentence, which is a naming accident rather than a decision.

### 10. It is `peerSearch` again: a module, with its observations injected

> **Andy:** *"for testing purposes, we can reduce the ram-size and fake
> other constraints on local test relays to test the adaptable rate and
> limit management."*

That requirement decides the shape, and it should be taken further than it
sounds: **fake the observation, not the resource.**

Really constraining a box tests V8's OOM behaviour. Injecting *"rss is at
90% of your budget"* tests the governor. Only the second belongs in a suite
— so the governor must never call `process.memoryUsage()`, `Date.now()` or
a socket itself. It is handed what it is allowed to know:

```
govern({
  budget:   { rssMax, bytesPerMinMax },   // what this relay believes it has
  observed: { rss, routes, ring },        // the ring of {bytes, elapsed, latency}
  now,                                    // injected clock
})  ->  { perMemberBytes, perMemberRoutes, floorHeld, why }
```

The precedent is exact, and it is Andy's:

> *"i want the graded search logic and that stuff isolated from relay or
> other core components, since quality-of-result measurements etc. are up
> in the air and we need to have this block separately tested and verified,
> and give it an independent evolution path."*

Every word of that is true of a rate governor, and for the same reason: what
a good limit is will be wrong on the first try, and `relay.js` should hold
no opinion about it. `relayStatus.report` already takes `proc` and `now` as
options rather than reading them, so the pattern is in the neighbourhood
already.

**Why this matters more here than it did for search.** An adaptive limit has
*history* — a ring, a decaying peak, a value committed until the next
announcement. Against a live box those are untestable in practice: you
cannot make a relay run out of RAM on demand, you cannot hold a link at 80%
for ninety seconds, and every run differs. Against an injected clock and a
handed-in ring they are ordinary assertions, and the edges become reachable:

| assertion | what it catches |
|---|---|
| the floor holds as capacity → 0 | the starvation failure mode, including the packet that would report it |
| plateau + rising latency lowers the published number | the ceiling is *discovered*, not merely tracked |
| a quiet hour does not raise the ceiling | throughput mistaken for capacity |
| the peak decays out of the window | yesterday's 03:00 figure applied at 21:00 |
| a fresh relay starts conservative | no configuration, safe by default |
| the value does **not** move between announcements | committed-until-superseded, which is the whole anti-flap property |
| the refusal names the number | a page that waits instead of giving up |

Every one of those is a pure function of injected inputs. None needs a
socket, and none is flaky.

**And the lab still has a job.** The in-process suite proves the policy; a
lab relay handed a small *declared* budget proves the wiring — that the
number reaches a member's stream and a partner's, that a client pre-checks
against it, that a refusal carries it. `labMaster` already builds relays
with their own homes, so "start this one believing it has 32 MB" is a field
in the node record rather than a new mechanism.

Two traps worth naming before anybody builds it:

- **A governor that reads the world cannot be tested, and will therefore be
  tested in its comfortable region only.** That is the failure this
  recommendation exists to prevent: adaptive systems are easy to demonstrate
  working and hard to demonstrate failing safely.
- **A declared budget must never be readable as a real one.** If a lab
  relay's fake 32 MB can reach production configuration, the floor becomes
  lowerable by a setting — which is exactly what the carve-out below
  forbids.

---

## The carve-out: the node's floor stays a constant

A constant is right exactly when its purpose is **to be unnegotiable**, and
those two numbers are a jail rather than a fair share:

> *"It lives here rather than in a file because a floor in a file is a floor
> somebody can lower. AGENT.md: the server is the only jail."*

The floor also draws the distinction this whole document depends on:

> *"the PREFERENCE decides who you talk to — the FLOOR decides what a
> stranger can spend."*

Widening reach touches the first. It must never touch the second. **If the
floor became a function of anything, the one number that does not move when
reach widens would start moving** — and the argument at the top of this
document, that the conduit decision costs nothing here, would stop being
true.

---

## Open

- **What is the interval?** "Reasonable" is doing work in the decided list.
  Too short and the stream is chatter; too long and the committed value is
  stale during exactly the burst it exists to govern.
- **Partner streams carry "request and reply, and nothing else"**
  ([partnerLink.js:106](../../spirit/run/js/partnerLink.js#L106)),
  deliberately. A limits event widens that. Defensible — it is the relay's
  own state, not anything about its members, so the roster rule is untouched
  — but it should be a written decision rather than a side effect.
- **Which number wins** when the streamed value and a client's cached one
  disagree, and what a member who has never streamed assumes before its
  first announcement. The refusal makes this survivable, not correct.
- **Does the ceiling apply to the owner?** An owner posting to its own relay
  is not a stranger and not really traffic; whether it is governed at all is
  undecided.
- **What does a relay do when RAM is the binding constraint rather than
  bandwidth?** Shedding hint lists is already designed (PARTNERS.md, *"the
  algorithm, and it is a division"*). Whether rate and shedding are one
  governor or two is not.
- **Nothing measures any of this yet.** The figures above are the ones the
  relay already reports; no suite drives them under load, and `liveRelay.js`
  is the only thing in the tree that touches a real box.

---

## What it would touch

- `relay.js` — the ring, the governor, the `routePost` gate that does not
  exist yet, and the stream event.
- `relayStatus.js` — the published figure, beside `routes` and `memory`.
- `partnerLink.js` — accepting the event on a partner stream.
- `presenceNode.js` — accepting it on a member stream.
- `limits.js` — nothing, and that is the point of recommendation 9.

**This is `relay.js` gate and persist-shape work, which CLAUDE.md names as
a stop-and-call-a-team-review line.** Nothing here should be built from this
document alone.
