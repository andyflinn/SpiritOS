# Filling the gaps — what the request-budget design left unbuilt

**Plan, 2026-09-21. Nothing here is built. Measured against `bfd5df0`.**

> **Andy:** *"i want a plan to fill the gaps."*

Two days of design ([REQUEST-BUDGET.md](../relay/REQUEST-BUDGET.md),
[0016](../decisions/0016-a-relays-capacity-is-its-membership.md),
[0007](../decisions/0007-a-relay-survives-and-earns-its-keep.md)) produced
five product files of code and a great deal that is argued and unwritten.
This says what is left, in the order the dependencies allow, and marks
which parts are Claude's to build and which are not.

**The harness stands at 107 suites, 2534 green, 0 red.** Every stage below
ends there or it does not end.

---

## What is already in code

| | where |
|---|---|
| three requester budgets — member / relay / partner | `router.js`, `relay.js` |
| per-target cap, and a `busy` refusal carrying `retryAfterMs` | `router.js`, `relayServer.js`, `relayConfig.js` |
| the node's post scheduler — one in flight per relay, ordering, classes, split backoff | `postQueue.js`, `peerPost.js` |
| the owner's grant over `settable`, revoked, with two census guards | `governor.js`, `settableCensus.js` |

**What that proves and what it does not.** The **cap** is proven: one
request in flight per relay, on by default, across 107 suites, nothing
broken. The **queue behind it is largely unexercised**, because patience
defaults to zero — one attempt, exactly as before. Retrying is built and
inert.

---

## Stage A — node-side, no wire, no decision

**Claude's, and startable now.** Nothing here touches a packet.

### R1 — a route becomes `{ via, at, seen }`

> **Andy:** *"a node can be a member of multiple relays, if it only
> remembers B of the route, it won't know which relay to post a request
> through."*

`learnRoute(rootDir, publicKey, relayKey)` records the far relay key and
throws away two things it is holding:

- **`via`** — the relay that announced it. `server.js:1109`'s
  `onRoute(url, body)` HAS it and passes it no further. Without it a node
  on three relays guesses which door to use, and at a ceiling of one a
  wrong guess spends the member's only slot.
- **`seen`** — when it last worked. `normalizeRoutes` keeps 8, newest
  first **by position**, so nothing distinguishes a route proven a minute
  ago from one proven in March. A stale route leaves only by being
  displaced, and four ride out as hints on every post meanwhile.

**Both are free at the point where one line currently discards them.**

Shape change to a persisted file, so: existing bare-key rows stay valid as
*"some relay of mine proved this once"* and are simply less useful than
new ones — degrades rather than breaks.

**Status:** OPEN — not built. Node-side and unblocked — the first thing to build.

### R2 — `background` marking, so the class split stops being decorative

The scheduler ranks deliberate above background and **nothing marks
itself background**, so a fifty-card sweep still outranks a message a
person just typed. That is the gap the class split was built for, still
open.

Needs `{ kind }` threaded through `api.peerPost` so
`contactsAskEveryone` can say what it is. Node-side API shape, not wire.

**Status:** OPEN — not built. Needs `{ kind }` threaded through `api.peerPost`; the scheduler half is done and proven in `spirit/test/postQueue.js`.

### R3 — queue depth, and what is shed at the limit

Unbounded today. Harmless at patience zero, a leak the moment patience is
days. **Shed background before deliberate** — shedding oldest would
invert Andy's ordering rule.

**Status:** OPEN — not built, and harmless until patience is non-zero, which no caller sets.

### R4 — route expiry using `seen`

Falls out of A1: a route not proven in N days stops being sent as a hint.
Distinct from eviction of the contact, which never happens for staleness.

**Status:** OPEN — not built. Depends on R1, which supplies `seen`.

**Stage A ends with:** the scheduler honest about priority and bounded in
size, and a route that is a whole edge rather than half of one.

---


## Stage B — the ceiling drops to 1

**One decision, no wire, and the decision is Andy's.**

### R5 — the timeout is a duration, carried, and diminishing inward

> **Andy:** *"the relay has no business waiting for 15 seconds... your
> concept of diminishing timeouts down the request chain is not
> implemented."* — *"N1 sets a limit on its patience, which gets reduced
> down the chain by the formula you proposed."* — *"part of the request's
> sidecar/envelope."* — *"we start with 5 seconds at the most. the willing
> to wait time in a request is informational, and the next station down
> the chain better hurry."*

**Today the chain is inverted and flat in the middle**, and the numbers
are four rather than two:

| waiter | holds | where |
|---|---|---|
| node's post | 8 s | `peerPost.js:43` `DEFAULT_WAIT_MS` |
| **the relay's note about it** | **20 s** | `router.js:92` `DEFAULT_TTL_MS` |
| relay -> partner hop | 8 s | the same constant, via `partnerRouter` |
| relay's own posts | 15 s | `relay.js:95` `ROUTE_WAIT_MS` |

The inner hop outlives the outer waiter, which orphans a slot for twelve
seconds; and the partner hop waits exactly as long as the node's, so
neither is guaranteed to hear a real answer from the other.

**What is to be built, in five parts:**

1. **A remaining DURATION in the envelope**, beside `hints`/`hintSig` —
   never an absolute deadline, because a timestamp needs two boxes to
   agree about the clock. Same rule as `0011`'s hash.
2. **Each hop grants `min(asked, its own ceiling)`**, so the carried
   number is **informational** and may only ever ask for *less*. A hold
   time a member could lengthen would not be a limit, it would be a
   default.
3. **The ceiling is 5 s, a code constant**, replacing
   `DEFAULT_TTL_MS = 20000` — an unargued number of the kind `0016`
   retired the `256`/`16` pair for.
4. **The router's TTL becomes per-entry.** `sweep()` compares against what
   each entry's requester asked for, not one table-wide number, so a slot
   is held exactly as long as somebody is waiting.
5. **A floor: too little budget earns an immediate refusal**, not a note
   certain to expire — `0006`'s *"deliver or refuse, refuse instantly"*
   applied to time.

**Why this supersedes the cancel-or-align choice this requirement first
described.** Because every hop grants no more than it was asked for,
**every hop finishes before the hop outside it gives up, by
construction** — the inversion becomes unexpressible rather than fixed,
there is no ladder of constants to keep in step, and `cancel` (R10) stops
being a prerequisite for anything.

**Verify:** `spirit/test/budgetChain.js` — the table grants
`min(asked, ceiling)` and expires per entry; a budget below the floor is
refused with `tooLittleTime` and nothing is forwarded; zero is a
declaration and not an absence; a partner is handed 3500 ms of the 4000
this relay was asked for; and the refusal crosses a real socket with its
marker intact.

**Status:** DONE — `DEFAULT_TTL_MS` is 5000 and is now a ceiling rather
than an answer; `budgetMs` rides the post envelope; `relay.js` grants and
passes on `budgetMs - HOP_MARGIN_MS`. R10 (`cancel`) is no longer a
prerequisite for anything, and R7 is unblocked.

### R6 — `maxPerTarget` out of config, into code

Put in `relay-state/config.json` on 2026-09-20 arguing *"only ever written
by a person with a shell"* — the argument revoked hours later. **By the
three-tier rule it is a limit, so it is the code's.** It stays only
because `targetBusy.js` spawns a real relay and has no other way to switch
the cap on; when the constant lands at 1 that suite needs no
configuration at all.

**Status:** OPEN — not built. Blocked on R5 and R7: the config entry is the only way `spirit/test/targetBusy.js` can switch the cap on until the constant lands.

### R7 — drop the ceiling to 1 and run the experiment

Setting `DEFAULT_PER_TARGET = 1` on 2026-09-20 produced **10 red beyond
the revocation**: `relayMeter` (4, including *"routePost is unlimited"*
which `0016` already marks for repeal), `routeHints` (3, the partner path
genuinely needing the queue), `router.js` (3, fixtures assuming an
uncapped target). That is the evidence for what B1–B2 have to fix first.

**Status:** OPEN — not built. Blocked on R5. The 2026-09-20 experiment recorded 10 red as the checklist.

**Stage B ends with:** the ceiling at 1, green, and the sequential
guarantee real rather than argued.

---


## Stage C — the wire

**Not Claude's.** `CLAUDE.md`: a change needing the wire is a team review,
not a patch. Grok reviews in a batch once Andy-initiated design is green,
so this is Andy's to route, not a gate on Stage A.

### R8 — `viaUrl` in a search answer, the gap under everything

`relay.js:2728` builds a partner's answer as `{ via: p.relayKey, rows }`
while `p.url` sits unused on the same object. So a foreign peer arrives
with **a key and no address**, and acquisition writes nothing to `relays`.

**Nothing in the tree can dial a relay it has not met.** Route pairs, the
on-demand handshake, provisional rows and a self-assembling roll all
assume somebody can, and nobody can.

It discloses nothing — a relay's URL is how anybody reaches it, and
`/api/relay/who` is already public and unsigned.

**Status:** OPEN — not built. Wire, therefore a team review.

### R9 — hints carry `{ key, url }`

`HINTS_PER_POST` sends relay keys, so even holding a URL a node cannot
**tell** its relay where an unknown relay is. Without this, C1 unblocks
one end and leaves the other blocked.

**Status:** OPEN — not built. Wire, therefore a team review. R8 without it unblocks one end and leaves the other blocked.

### R10 — `cancel`, exposed to a member

Resolves B1 in the direction that keeps the shorter node timeout.

---

**Status:** OPEN — not built, and no longer a prerequisite — R5 makes the inversion it cleans up after structurally impossible. Kept for a caller giving up by choice.

## Stage D — the partner architecture

**Needs C, and needs one rule Andy has not made.**

### R11 — the URL rule, a prerequisite and not a follow-up

`NODE-AND-RELAY.md`'s *"a relay may only ever reach a URL its owner wrote
down"* is broken by the sizing: hundreds of partnerships nobody can
curate. `assertRelayUrl` (`relayRequest.js:42`) was sized against
owner-written URLs and permits **`http://` to loopback on any port** and
**`https://` to any private address**.

Not exploitable today, because every partner URL comes from `setPartner`,
an owner verb. **Live the moment a URL can come from a member**, which is
what C2 enables.

**Status:** OPEN — not decided, and it is Andy's to decide. A prerequisite for R14 rather than a follow-up, since R9 is what makes it exploitable.

### R12 — `last` on a partner row

`relayStore.js:103` has `since` — when the partnership began — and nothing
about when it last worked. That column **orders searches** (replacing
`presentNow.isPresent`, which goes with the streams) and is what makes
D3 possible. It does **not** evict: the roll is the reach.

**Status:** OPEN — not built. Depends on nothing; needed before R13 removes the liveness the streams supplied.

### R13 — no streams between partners

Removes the partner stream pool, the `presence.js:145` contention with
members, most of `partnerLink.js`, and collapses relay↔relay to **one
verb** — the response to a post *is* the reply, which the forward path
already does in production.

**Status:** OPEN — not built. Bones and wire together, so a team review.

### R14 — open partnering, provisional rows, and a visible count

Self-formed partnerships land as `requested` (a status `relayStore.js:24`
already reserves) — evictable freely, where owner-granted rows are not.
Recommended **on** by default, with a count the owner can see, so a relay
that has quietly acquired four hundred partners is a fact somebody
noticed rather than discovered.

---

**Status:** OPEN — not built and not decided. Needs R8, R9, R11 and R12.

### R15 — the per-stream measurement

**Status:** OPEN — not measured. Blocks no stage and is blocked by none; four conclusions rest on it.

## Crossing all of it

**`STREAMS_PER_MB = 16` is a placeholder `governor.js` marks as guessed in
its own comment**, and four conclusions now rest on it:

- what a micro-relay actually costs to run
- whether *"1000 members"* can be put in front of anybody
- whether `connections` can stop being a lever and become
  `ram_available x streams_per_mb`
- how many members a box actually holds

`0016` already calls it *"the highest-value measurement in the project"*.
It needs no stage and blocks no stage, and the apparatus exists — the
Governor reads `heapUsed` every tick.

---

### R16 — the queue survives a restart

Patience *"could be days for a text message"* (Andy), and days means
restarts. The queue is in memory: `postQueue.js` holds `items` in an
array and nothing writes it down, so a node restarted mid-wait forgets
every intent it was holding.

A new persist shape, which `CLAUDE.md` makes a team review rather than a
patch. `relay-state/relay.db` is the precedent for a node-side store a
cycle opened deliberately.

**Two things it must get right**, both of which fall out of R5's rule
that durations are measured on a clock that cannot jump: a persisted
deadline has to convert to wall-clock on the way out and be recomputed on
the way in, and a restart must not reset a backoff a peer had earned.

**Status:** OPEN — not built, and nothing needs it until a caller sets a
patience. `peerPost` defaults to zero, so retrying is inert today.

### R17 — suites clean up the homes they create

Every suite that calls `fs.mkdtempSync` leaves the directory behind.
**160,116 of them were found in `%TEMP%` on 2026-09-20**, and the disc
contention made three consecutive harness runs progressively redder while
each suite passed alone — which reads exactly like a regression and was
not one.

`plantRun.js` shrank each leaked directory from 143 MB to 3.8 MB
(`17c6bc1`) but nothing stopped the leaking: a full run still leaves
roughly two hundred.

**Status:** OPEN — the once-off cleanup ran; the leak itself is untouched.

### R18 — durations are measured on a clock that cannot jump

The scheduler orders by sequence, never by wall-clock, because a burst
shares a millisecond. It must also *measure* on a monotonic clock: an NTP
correction, a suspend or a manual change fires a backoff early, strands
one for the length of the jump, and expires patience on evidence that
never happened.

**Verify:** `spirit/test/postQueue.js` — the default clock is
process-relative rather than epoch, checked by magnitude so a revert
fails here rather than on somebody's laptop after a clock change; and a
backoff measured on the real clock is the length it claims.

**Status:** DONE

### R19 — the load fixture, and seeing it stay lively

The verification this whole cycle was scoped around, and the one thing
from Andy's original framing that has not been done:

> **Andy:** *"i see node request q-ing/scheduling, verification that
> not-available errors causes re-scheduling of the request. and visually
> verifying that natter and contacts still react as lively as before..."*
> — *"if you fire all at once, the queing and scheduling will be put to
> the test."*

Two fixtures, and neither substitutes for the other:

- **one node, wide fan-out, most targets stalling** — proves the node's
  own queue: cap, backoff, head-of-line. Requests **time out**; nothing
  refuses them.
- **two nodes at one target** — proves the *not available* path, emitted
  by the relay rather than simulated. `spirit/test/targetBusy.js` is this
  one, in miniature and over a real socket.

And then the part no suite can do: **looking at it.** Natter and Contacts
reacting as lively as before, with the cards filling in progressively
rather than hanging, which `contacts.js` already renders per card.

**Status:** OPEN — `targetBusy.js` covers the second fixture. The
wide-fan-out fixture does not exist, and nothing has been looked at: the
lab has not been rebuilt since 2026-09-20.

### R20 — the Governor's remaining job

> **Andy:** *"right now it looks like the governor will be unemployed, not
> re-elected..."*

`allowed()` is arithmetic and needs no Governor. `state()`, `levers()` and
`lastDecision()` are reporting and stay. `lever(name)` serves an owner
verb that `0015` stopped and the 2026-09-21 revocation sealed. **`tick()`
is the only governing act left**, and it exists to correct a ceiling that
is wrong only because `STREAMS_PER_MB = 16` is a guess.

So the work is: measure the per-stream cost (R15), then decide whether
what remains is a reporter or a reporter with a safety net — a computed
ceiling assumes per-member cost is stable and heap is not.

**Status:** OPEN — depends on R15. `0017` records the decision and what it
supersedes.

## The order, and why

```
A  (node-side)        startable now, no decisions
B  (ceiling to 1)     needs B1 ruled: cancel, or align the timeouts
C  (wire)             team review; unblocks D entirely
D  (partners)         needs C, and needs D1 ruled before it ships
```

**A does not wait for anything.** B waits on one ruling. C is a review. D
waits on C and on the URL rule.

**Nothing is deliberately left out any more.** Persistence was prose in
the first draft of this plan and is now R16, because a gap described in a
paragraph is a gap that can be forgotten and a requirement is a count the
harness keeps asking about.
