# The Relay Monitor — what an owner watches, and what he may not touch

**APPROVED by Andy, 2026-09-23**, including both open items — *"Open for
Andy: 1 + 2, yes."* He opened it with *"of monitor was already designed, it
is stale now."* and closed it with *"if yes let's all approve the monitor
design and move on."*

**Nothing here is built.** It is screen work for the UI session, and this
page is what that session builds against.

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

#### The first real use: watching his agents talk

> **Andy, 2026-09-23:** *"the testing for this must include my being able
> to monitor your messages, (even if the payload should be encrypted now)
> besides inspecting payload is NOT what this is for.... but just seeing
> your back and forth with it's timing tells me things, and is an example
> of ID-based filtering in the rolling console...."*

**This is the console's acceptance test**, and it is the right one because
it is traffic he already has, on a relay he owns, between two parties he
can name.

- **He filters by IDENTITY, not by caption.** The two agents' public keys
  are what the relay routes by; a label is a caption anyone may change. So
  the filter takes a key (pasted, or picked from a contact) and the relay
  applies it — `peer` in the existing monitor filter.
- **What he sees is the envelope**: who posted to whom, when, how big, and
  whether it was refused. That is all the feed has ever carried
  (`monitorEvent`), and it is what *"facts, never payloads"* means in
  practice rather than as a slogan.
- **The timing IS the content.** Andy: *"just seeing your back and forth
  with it's timing tells me things."* A ten-second gap is one agent
  thinking; a four-minute gap is one of them building; a burst of refusals
  is something wrong. None of that needs a word of what was said.
- **Sealing changes nothing here** (`CONSIDERATIONS-FOR-EARLY-PRODUCTS.md`
  §3). Once `peer.post` is encrypted, the payload is ciphertext to the
  relay and therefore to this screen — and the screen loses nothing,
  because it never drew payloads. The one thing sealing must not break is
  the envelope, which is what this pane is made of.

**So the acceptance criteria are:** open the console on the owned relay,
paste one agent's key, and see only that agent's traffic, both directions,
with times — across every owned relay when `All` is selected. If a
sealed-payload build still shows that, the feature holds.

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

## Decided by Andy, 2026-09-23

> *"hmmm. that's a key purpose of the monitor, yes: draw attention to what
> needs it. Open for Andy: 1 + 2, yes."*

1. **Retention, as proposed.** One row a minute for 90 days, then **one row
   a day kept for good**. The minute rows are what an incident is read
   from; the daily curve is what an investor is shown, and it is the half
   that must never be swept.
2. **The first screen is the `All` triage list**, ranked by need — because
   drawing attention to what needs it is *"a key purpose of the monitor"*.
   A single relay is what opening a row gets you, not what the app opens
   on.

   **What it ranks by, now that levers do not move:** connections against
   the allowance, and the roll against the disc figure — worst first, each
   row saying which of the two put it there (`binding`), each row opening
   its relay. The ranking stays a module on the node that a later cycle can
   replace, as the original design had it: the order is learned, so it is
   not in the screen.

   **And a relay with nothing wrong says so in one line.** A triage list
   that lists everything is a status board, which this is not: *"i only
   want to direct attention to where it's needed"*.

## What it costs

Screen work only. Everything it draws already exists on the wire or in
`node.db` — except the record's read verb, which is cycle 9's remaining
core piece. No relay change, no protocol change.
