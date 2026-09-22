# The Relay Monitor — what an owner watches, and what he may not touch

**For approval, 2026-09-23.** Andy: *"of monitor was already designed, it
is stale now."* — and, after the amendment: *"if yes let's all approve the
monitor design and move on."*

The design existed in `design/principles/NODE-AND-RELAY.md` §4, written at
cycle-4 planning on 2026-09-19. Cycles 8 and 9 made four parts of it false,
and that section is amended in place (`f424b8a`). **This page is the whole
thing, once, so the UI session has one document rather than a section and
its corrections.** Where the two disagree, this one is later.

---

## What it is for

> **Andy, 2026-09-20 (decision 0015):** *"The monitor should allow the owner
> to observe and see changes happening, not cause changes. see and record
> changes, in fact. and from the recording-analysis, teach the relay better
> effectiveness through program changes."*

**Observe → record → analyse → reprogram.** The owner's hand enters at
*reprogram*, between cycles, never at runtime. A screen that let him move
a value would make him an owner writing into his own training set (0009).

## Decided, and not reopened here

- **No lever is moved from this app.** 0015. The Governor that moved them
  is gone (cycle 8); the allowance is fixed at boot from the owner's RAM.
- **No lever is named in its code.** A lever invented next month draws
  itself, because the app draws what the report carries
  (`spirit/run/app/relayMonitor/relayMonitor.js:15-21`, held by
  `test/monitorApp.js`).
- **Facts, never payloads.** `relay.js:3352`, `:3712`. The monitor shows
  counts, states and figures; message text never reaches it.
- **The relay reports; the node decides what matters.** Grading, ranking
  across relays and "what is critical" are the node's.

## What it draws

### 1. The two bounds, and which one is biting

Cycle 9 gave a relay a second limit, and a screen that draws only memory
draws half the box.

| from the report | what it means on screen |
|---|---|
| `ramLimitMB`, `levers.connections1` | connections against the allowance — 16 streams a megabyte |
| `discLimitMB`, `discUsedMB` | the roll against the disc figure |
| `binding` (`ram` \| `disc`) | **which limit the next member meets** |
| `peers`, `present` | how many there are; how many are here |

**The warning at 70% goes against whichever is biting**, not against the
allowance alone. Andy, on why it exists: *"we monitor user-count and find a
way to afford more RAM before it's needed."*

**Absent is not zero.** A relay that has not reported, or a figure it does
not carry, is drawn as unknown — `relayStatus.js` deliberately omits rather
than zeroes, and the screen must keep that distinction visible.

### 2. The member curve, from the node's record

The relay keeps no history (0006). The owner's node does, since cycle 9's
decision: a table in `node.db`, owner-only, with stream open/close rows so
**gaps are recorded rather than guessed** — a quiet stretch and an outage
must not be drawn the same.

The curve is what makes the warning actionable: 70% today means nothing
without the slope that got there. Andy: *"that's angel-investor-time"* — the
same curve is the evidence when growth outruns sponsorship.

### 3. The live traffic console

> **Andy, 2026-09-23:** *"i'm also talking about the filtering vision in a
> scroll by 'console window' similar to that attached to rows in the 'jobs'
> app"*

A scrolling pane of the relay's live events, modelled on the jobs app's log
panel (`spirit/run/app/jobs/jobs.js`) — which already solves the two things
that make a live feed usable: a render throttle for bursts, and sticky
scroll that pins to the bottom while you watch and holds position when you
have scrolled up.

- **The feed exists**: `post`, `reply`, `refused`, each with from, to, bytes
  and hash (`relay.js`, `monitorEvent`).
- **Filtering happens AT THE RELAY** — `kinds` and `peer`
  (`relay.js:3969-3975`) — so only matching lines cross the wire.
- **`All` merges owned relays by time**, and one member's traffic across
  every owned relay is the same `peer` filter sent to each.
- **Live and forgotten.** Memory only; nothing written. The record (2) is
  figures, not traffic.

### 4. The configuration, readable

Cycle 9 lets an owner read and set a relay's figures over the wire. The
monitor **shows** what `{ config: {} }` answers — the figures, what the
relay is running on, whether it is clamped, what the box could give — and
**does not set them**. Andy: *"remote adjustment with possibly restart must
be there, at least in the core, not neccessarily in UI."*

## What it is not

- **Not a status board.** wsl-claude, on the digest that shares this
  principle: a list of things that need attention, not everything that is
  true.
- **Not a place payloads appear.**
- **Not a lever panel.**
- **Not the only way to see a relay.** Plenty of Linux developers have no
  browser on the box; the door and the `relayLimits` program answer the
  same questions from a terminal.

## Superseded by cycles 8 and 9 — recorded so it is not rebuilt

| the old design said | what is true now |
|---|---|
| relays push a report **every Governor tick** while the monitor is open | there is no tick; a relay reports **on every event**, in full, with no coalescing (cycle 8) |
| triage ranks by **lowest lever headroom** | levers do not move; rank by connections against the allowance, and the roll against the disc figure |
| one bound, `ramLimitMB` | two, with `binding` saying which is nearer |
| *"the relay is a sensor, the node the recorder"* — a metaphor | a store: `node.db`, owner-only (cycle 9) |

## Open — for Andy

1. **The record's retention.** Proposed: one row a minute for 90 days, then
   one row a day kept for good. The daily curve is what an investor is
   shown; the minute rows are what an incident is read from.
2. **The first screen**: the `All` triage list, or the single relay he
   opened. The original design said `All` and ranked it; the ranking's
   terms have changed, so the choice is worth making again.

## What it costs

Screen work only. Everything it draws already exists on the wire or in
`node.db` — except the record's read verb, which is cycle 9's remaining
core piece. No relay change, no protocol change.
