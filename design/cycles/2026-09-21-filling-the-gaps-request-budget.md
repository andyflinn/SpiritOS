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

### R5 — the carried timeout budget, diminishing down the chain

```
node gives up   8000 ms   peerPost.js:37   DEFAULT_WAIT_MS
relay lets go  15000 ms   relay.js:95      ROUTE_WAIT_MS
```

**The scheduler made this worse, not better.** Before the queue the node
simply stopped waiting. Now it releases its own slot at 8 s and dispatches
the next request into a relay still holding the member's only route —
seven seconds of guaranteed refusal, which at cap 1 looks like contention
and feeds the wrong backoff.

Latent today (per-requester is 16, per-target is off). **It arms itself
the moment the ceiling drops**, which is this stage.

**Two repairs and only one keeps the shorter node timeout:**

1. **Expose `cancel`** — `router.js:140` has it and enforces that only the
   opener may call it; nothing exposes it to a member. **Wire**, so
   Stage C.
2. **Make the node's wait no shorter than the relay's.** Costs nothing to
   build, throws away the shorter timeout's whole benefit.

**Andy's to rule.** Stage B cannot start until he does.

**Status:** OPEN — not built. A new envelope field, so it is a wire change and a team review — it replaces R10 rather than joining it.

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

## The order, and why

```
A  (node-side)        startable now, no decisions
B  (ceiling to 1)     needs B1 ruled: cancel, or align the timeouts
C  (wire)             team review; unblocks D entirely
D  (partners)         needs C, and needs D1 ruled before it ships
```

**A does not wait for anything.** B waits on one ruling. C is a review. D
waits on C and on the URL rule.

**What is deliberately not in this plan:** persistence for a patience
measured in days. It is a new persist shape, which `CLAUDE.md` makes a
team review, and nothing in A–D needs it — patience beyond a single
attempt is opt-in and unused until somebody asks for it.
