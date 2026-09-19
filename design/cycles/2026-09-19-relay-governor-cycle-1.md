# 2026-09-19 — the first Governor: one lever, one remedy, a reason each move

**Status: OPEN.** Scoped in
[NODE-AND-RELAY.md](../principles/NODE-AND-RELAY.md) (Decided — *cycle 1
scope*, *proof of closing*). Cycle 0 (`4d32104`) came first: the relay is its
own startup module, so what is measured here is a relay carrying no node code.

> **Andy:** *"First we only measure cheap measurements, that is enough to
> prove the overall design. The Governor will be simple. The monitor on the
> owner's node as well. Then we learn from the results."*

## What was settled while planning (Andy, 2026-09-19)

- **Stress is member connections.** A relay's RAM is held by the streams its
  members open; the router keeps hashes, not bodies. Partner traffic is not
  needed, and route hints stay deferred with acquisition — *"no hacks to
  alter the interface."*
- **The one lever is the connection allowance.** Verified before building:
  nothing bounded the total number of held streams (one per identity, six
  connects a minute, authenticated — and as many identities as the roll had).
  Requests were already bounded (router 256 / 16 per member, 600 a minute).
- **The one remedy:** lower the allowance and close the **longest-idle**
  streams first — never the owner, never a stream with a post in flight.
- **heapUsed governs**, because it can be seen to fall after a shed; rss is
  reported beside it. **The process backstop is deferred.**
- **Configuration:** `relay-state/config.json`, `{ "ramLimitMB": 256 }`,
  default 256, bounded by the box.
- **No new word on the wire.** No new route, verb, stream event or owner-event
  kind: the allowance refuses with a status, eviction is the ordinary
  `presence` absence, the Governor's state rides the existing `relay-status`
  report.

## Requirements

### R1 — the relay's first configuration, bounded by the box

`relayServer.js` reads `relay-state/config.json` once at boot, through the
pure `js/relayConfig.js`. Missing → 256 MB. Not a positive number, not JSON,
or larger than the machine → the relay refuses to start and says why. Never
re-read.

**Verify:** `spirit/test/relayConfig.js` — default, file value, over-box
refusal, five kinds of nonsense refused with a sentence; and
`spirit/test/governorTwoRelays.js` — each spawned relay reports the ceiling it
read (1 MB from a file, 256 MB by default).

**Status:** DONE

### R2 — the connection allowance, with the owner as its floor

`presence.createRegistry` holds an allowance (unlimited until set, so a relay
without a Governor behaves as before). A newcomer over it is refused with
**503** and a `Retry-After`; a reconnect replaces its own stream and needs no
room; **the owner is admitted whatever the count**. `evictIdlest(n, spare,
lastActive)` closes the longest-idle streams, sparing the owner and any
identity with a post in flight. Last activity is the member's most recent post
from the rate bucket the relay already keeps — no new record per member.

**Verify:** `spirit/test/governor.js` — refusal at the allowance, owner over
it, reconnect, idle order, spared streams; and
`spirit/test/governorTwoRelays.js` — five members refused with 503 over a real
socket.

**Status:** DONE

### R3 — the Governor, one rule, in twelfths

`js/governor.js`, pure. Floor 1 (the owner), ceiling `ramLimitMB ×
STREAMS_PER_MB` — **a declared placeholder (16), to be replaced by the
per-stream cost this cycle measures**. Heap above 85% of the ceiling: one
twelfth down and close to fit. Below 60% for three ticks: one twelfth up. One
step per tick. Ticked every 5 s by `relayServer.js`. Posts in flight are the
router's `countFor`, which now sweeps expired posts first — *expiry must
decrement too*.

**Verify:** `spirit/test/governor.js` — start at 12/12, step down with a
reason, one step per tick, hold in the band, recover after calm, stop at the
floor.

**Status:** DONE

### R4 — the report carries it

The `relay-status` report gains `ramLimitMB`, `levers.connections` (position,
allowed, floor, ceiling) and `decision` (from, to, why, closed, at). Absent on a
relay with no configuration. `protocolSurface` unchanged.

**Verify:** `spirit/test/governorTwoRelays.js` — the lever move, its reason
(`heap N% of 1 MB (above 85%)`) and the closed count arrive on the owner's
stream; B, under its bound, reports 12/12 and no decision.

**Status:** DONE

### R5 — the monitor

`app/natterDetails` draws, beside Owner/Mode/Peers/Connected: Heap (of the
ceiling, with %), RSS, In flight, Activity (posts, bytes/s over the window),
Connections (position, allowed, floor, ceiling) and Last move. Each row only
when the relay sent its field. The node nudges the page on every report,
paced to one a second per relay, so a shed is seen as it happens (the page
itself keeps no timer — `natterIntrinsic` guards that).

**Verify:** `spirit/test/natterIntrinsic.js` (the panel keeps no timer) and
`spirit/test/presenceNode.js`; the rest is Andy looking, in the live run (R7).

**Status:** OPEN — drawn; not yet seen by Andy.

### R6 — two relays, two owners, confirming each other

Two relay processes on loopback, each owner a member of the other's relay.
Each owner gets only its own relay's report; the rolls differ; what owner A
does on B (a stream, five posts) appears in B's report to owner B, and the
reverse; posts in flight return to zero; on A under a tiny ceiling, the
allowance refuses, the lever moves with a reason, idle streams close, and the
owner stays connected.

**Verify:** `spirit/test/governorTwoRelays.js` — 16 checks.

**Status:** DONE

### R7 — the live run, watched hands-off

labMaster relays on the workstation (never spirit-3), a driver opening many
member streams and posting, then going quiet; Andy watches heap and streams
rise, a shed with its reason, heap fall back under the ceiling.

**Status:** OPEN — the driver is not written. See *Open* below.

## Open

- **Live-run tooling (R7).** Enrolment over the wire is gated at ten claims a
  minute per client address — every lab claim comes from 127.0.0.1 — so a
  driver that enrols hundreds of members on a running relay would take most
  of an hour. The harness avoids it by writing the roll before the relay
  starts. How the live run gets its population is Andy's call.
- **What one stream costs.** `STREAMS_PER_MB` is a placeholder; the live run
  is where it gets measured.
