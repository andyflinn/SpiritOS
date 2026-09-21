# What a box actually holds

**Measured 2026-09-21 against `59ed8bb`**, on Windows 11 with Node
v24.20.0. Every number here came off a running process or a real file.
Where something is still a guess, it says so.

> **Andy:** *"the README.md should contain a summary of what the capacity
> of a relay with 100 MBytes of RAM and 1 Gigabyte of DISC is for members
> and partners, and the capacity of a node with 1 MBytes of RAM and 10
> Megabytes of DISC are capable of."* — *"let's keep honest score. it will
> be impressive."*

**Re-measure it rather than trusting this page:**

```
node spirit/test/measureCapacity.js
```

It spawns a relay and a node, enrols 800 members, holds 800 sockets and
writes 11,000 rows — about a minute. It prints this page's tables.

---

## Minimum to run

| | |
|---|---|
| **Node.js** | **22.13 or later** — `node:sqlite`, which both stores need |
| **Dependencies** | **none.** Built-ins only; there is no `npm install` |
| **Install size** | **3.7 MB**, 110 files |
| **RAM, personal node** | **72 MB** at rest |
| **RAM, relay** | **60 MB** at rest, before anybody connects |
| **Disc, either** | tens of kilobytes to start; what grows is your own traffic log and your peer cache |

**Node.js is 49 MB of that**, and it is the floor under everything below.

---

## The two boxes

**These are the two the README presents**, and they are the two Andy
named: a relay on 100 MB of RAM and a node on 10 MB, both with a gigabyte
of disc. The node's RAM figure is the one that does not survive contact
with the runtime, and that is the honest half of the answer rather than a
failure of the question.

### The smallest box that is honest

**128 MB, for either role**, and the reason is the same for both: bare
`node` with nothing loaded is **49 MB** resident. The floor belongs to the
runtime, not to this system — what is actually SpiritOS is ~11 MB on a
relay and ~23 MB on a node.

| RAM | connected at once, Windows | … Ubuntu |
|---|---|---|
| 64 MB | 70 — **too tight to mean anything** | ~100 |
| 100 MB | ~700 | ~950 |
| **128 MB** | **~930** | **~1,500** |
| 256 MB | ~2,700 | ~4,300 |
| 512 MB | ~6,200 | ~9,900 |

**It is a straight line above the floor, and the slope is the platform's**:
a held connection costs ~61 KB of the relay process on Windows and ~42 KB
on Linux, and nothing else about a relay grows with use. Below ~64 MB
there is no line at all: the fixed cost has eaten the box.

**These are the process only.** The kernel's share per connection is real
and could not be measured on either platform (see *What the kernel costs*,
below) — which is why an owner should give a relay at most half the box.

**A node does not have this table**, because a node does not hold
hundreds of connections — it holds one per relay it is a member of. Its
128 MB buys headroom for the shell, the apps and the job system, not
concurrency.

### A relay with 100 MB RAM and 1 GB disc

```
100 MB   total                       (Windows figures, process only)
- 49 MB  Node.js itself
- 11 MB  the relay
= 41 MB  left for connections
/ 58 KB  per held stream
= ~700 members connected at once     (~950 on Linux, at ~42 KB)
```

**And 1 GB of disc holds 5.5 million of them enrolled** — or 3.8 million
partner rows.

**The gap between those two numbers is the design.** A relay can *know* a
million people and *hold* seven hundred conversations. The roll is cheap;
the connection is not.

**Said plainly: 100 MB is a tight box.** Half is gone before SpiritOS
starts and the arithmetic leaves nothing for the operating system. Treat
~700 as the ceiling of a machine doing nothing else.

### And the smaller node, for contrast: 1 MB RAM and 10 MB disc

**1 MB is not possible**, and no arrangement of this code makes it so.
Bare Node.js is 49 MB resident before a line of SpiritOS runs; a personal
node settles at 72 MB. A node's floor is the runtime's floor.

**10 MB of disc is generous for what a node keeps:**

| | |
|---|---|
| reachable peers, at 577 B each | **~18,000** in 10 MB |
| an empty `node.db` | 56 KB — 20 KB before the post queue moved in (R16), 52 KB before the chosen index (R38) |
| contacts, identity, relay pins | kilobytes |
| the traffic log | grows with what you actually send, and is permanent by decision |

**But the shipped peer-cache default is 20 MB, which does not fit.** That
is not a flaw in the example — it is the case the owner's cap exists for.
A node on a 10 MB disc sets its cache to 2 MB and holds 3,600 reachable
people, which is still more than anyone meets.

**On a small disc the traffic log is the thing to watch**, because it is
the one file here that only grows. It holds what you sent, not what the
network told you.

### A node with 10 MB RAM and 1 GB disc

**10 MB of RAM is still not possible**, and for the same reason 1 MB was
not: the floor is Node.js's, and Node.js is 49 MB before SpiritOS loads.
A personal node settles at **72 MB**, so the smallest honest box is
**128 MB** — which leaves room for the operating system as well.

**1 GB of disc, though, is more than a node can find things to put in
it** — and the shipped defaults say so:

| | | share of 1 GB |
|---|---|---|
| the program | ~2 MB | 0.2% |
| the node's bookkeeping | ~40 KB | — |
| **the peer cache, at its 20 MB default** | 20 MB ≈ 36,000 people | **2%** |
| **everything left for you** | **~1,002 MB** | **98%** |

> **Andy:** *"...with the nodeStore defaulting to max of 20 Megabytes."*

**So the cache is 2% of the disc and never the constraint.** On this box
the default could be raised to hold every person the node will ever hear
of and still not be the thing that fills the drive.

**What actually fills 1 GB is the two things that only grow:**

| | |
|---|---|
| **the traffic log** | **~2.4 million exchanges**, at 438 bytes each, kept for ever |
| **media** | ~500 photographs from a phone, at 2 MB each |

**2.4 million exchanges is the number worth sitting with.** At a hundred
messages a day that is sixty-five years; at a thousand a day, six and a
half. The log is permanent by decision — it is your side of every
exchange — and on a gigabyte it outlasts the hardware.

**The shape of a node on 1 GB: it runs out of people to remember long
before it runs out of room to remember them.** The only real question is
how much of it you want to be media.

---

---

## Disc, split three ways

> **Andy:** *"the disc usage should be split into what the node needs, and
> what the shadow-roll/auto-memory uses and what the user-space on DISC
> looks like."*

Three different things with three different owners, and only one of them
is yours to worry about. Measured on a working node, 2026-09-21:

| | | |
|---|---|---|
| **the program** | `spirit/run/js` + `app` | **~2 MB** — fixed, arrives with the clone |
| **the node's own bookkeeping** | `relay-state/` | **~340 KB**, and 90% of it is one file |
| **the auto-memory** | `relay-state/node.db` | **tens of KB** empty, the cache **capped at 20 MB** by default |
| **your space** | `media/`, `published/`, `app/` | **92 MB** on this node, and unbounded by design |

### What the node needs

| | |
|---|---|
| `identity.json` | 263 B |
| `device.json` | 233 B |
| `relayKeys.json` | 629 B |
| `contacts.json` | 8 KB for 33 people — **~244 B a contact**, about what a remembered peer costs |
| **`traffic.jsonl`** | **304 KB — the only file here that grows on its own** |

**The traffic log is the node's real disc story.** Everything else is
kilobytes and stays kilobytes. The log is permanent by decision — it is
your side of every exchange — so on a small disc it is the thing to watch,
and it grows with what *you* send rather than with what the network tells
you.

### What the auto-memory uses

`node.db` holds what this node has been told about people: where they
live, what they call themselves, when it last had evidence. **It is
capped**, it evicts oldest-first, and at 577 bytes a reachable peer —
157 for the name, 420 for the route — the 20 MB default is about 36,000
people. Andy called it *"a small city"*; measured properly it is a large
town, and the correction is in *What the second platform caught*. Nothing you do makes
it grow; nothing you lose by clearing it was yours.

### What your space looks like

**92 MB on this node, 91 MB of it media**, which is the honest shape: a
personal node's disc is your files, and everything the system needs is a
rounding error beside them.

---

## The browser is not a SpiritOS cost

> **Andy:** *"so the RAM usage on a node, including the shell (in Edge,
> Safari or Chrome) — it's not really a consideration what RAM is used
> there. The node doesn't seem to use much RAM, or does it?"*

**Correct, and no it does not.**

**The shell is a tab in a browser you already have open.** A Chrome or
Edge tab costs whatever that browser charges for a tab — commonly 50–200
MB — and that is the browser's accounting, not this system's. SpiritOS
adds one tab to a program already running.

**And 72 MB for the node itself is about one tab's worth**, of which 49 MB
is Node.js. The part that is actually SpiritOS is **~23 MB on a node and
~11 MB on a relay**.

**The honest comparison:** a personal node costs less RAM than the browser
window you look at it through.

## Fixed cost: what things weigh before anybody arrives

| | RSS |
|---|---|
| bare `node`, nothing loaded | **49 MB** |
| a personal node at rest | **72 MB** |
| a relay at rest, 0 streams | **60 MB** |
| — of which SpiritOS | ~11 MB |

**A node costs more than a relay**, which surprises people: the node
carries the shell, the apps, the job system and its own presence
connections, and the relay carries a roll and a router.

---

## Marginal cost: what one held connection costs

| streams | RSS | over baseline | per stream |
|---|---|---|---|
| 0 | 60 MB | — | — |
| 100 | 60 MB | 1 MB | 7 KB |
| 200 | 66 MB | 7 MB | 33 KB |
| 400 | 82 MB | 22 MB | 57 KB |
| 800 | 104 MB | 45 MB | 57 KB |

**~58 KB per held stream**, from the slope of the last segment.

**The early rows are not the answer and are shown anyway.** The first
hundred connections fit in memory the process had already reserved, so
they look nearly free; by four hundred the line is straight. A single
before-and-after reading would have produced any number between 7 KB and
58 KB depending on where it landed — which is why this measures a slope
and takes a median of three samples at each step.

### What this says about the Governor

`governor.js` computes its ceiling as `ramLimitMB × STREAMS_PER_MB`, with
`STREAMS_PER_MB = 16` — a number that file's own comment calls a guess.

> 16 per MB implies **64 KB** a stream. Measured: **~58 KB**.

**The guess was good, and wrong in the safe direction** — about 10%
pessimistic, so the computed ceiling sits slightly below what the box
would actually carry. Nothing was ever in danger; a little capacity was
being left unused.

---

## Disc: what a row costs

Written to real databases, index included, and the file differenced.

| | bytes per row |
|---|---|
| relay: a member | **197** |
| relay: a partner | **279** |
| node: a remembered peer, no route | **157** |
| node: one route for that peer | **420** |
| **node: a peer you can reach** | **577** |
| node: one logged exchange | **438** |
| an empty `relay.db` / `node.db` | 40 KB / 56 KB |

**A peer with no route is a real state** — a name a search returned,
waiting to become useful — but it is not what "remembered peers" was ever
claiming. The figure to quote is the one for somebody you can actually
reach, and it is **2.6× larger**. See *What the second platform caught*,
below.

**The log entry is the one number here taken from a real file rather than
a generated one.** 695 actual entries on a working node average 438 bytes;
the tool's own synthetic entries come to 253, because they carry a short
relay URL and no label. The tool reports both and this page uses the real
one — a measurement of traffic nobody sent is a floor, not a figure.

**Disc is not what bounds a relay.** A gigabyte is 5.5 million members. A
relay runs out of RAM, of bandwidth, or of its owner's patience long
before it runs out of room to write people down.

---

## Every platform measured so far

**One directory per box, in [README/CAPACITY/](CAPACITY/)**, written by the
tool rather than typed. Each carries its own `capacity.md` to read and a
`capacity.json` to compare against.

| platform | measured | tree | node | harness | per stream, process | a reachable peer |
|---|---|---|---|---|---|---|
| **[`ubuntu-24.04-wsl2`](CAPACITY/ubuntu-24.04-wsl2/capacity.md)** | 2026-09-21 | `4e94e2d` | v24.21.0 | — *(not run)* | **40 KB** | — *(pre-fix)* |
| **[`windows-10.0`](CAPACITY/windows-10.0/platform.md)** | 2026-09-21 | `f06d7e9` | v24.20.0 | **2665 green, 0 red** | **57 KB** | 577 B |

**There is no kernel column here, and that is the finding.** See *What the
second platform caught*, below: on Windows it swings 2.3× between runs, on
Linux it is below what the counter can resolve. A column nobody should
compare does not belong in the comparison.

**The date and the commit are on every row for a reason**: a platform
measured three cycles ago is making a different claim from one measured
today, and nothing else in the table would show it. Each platform's own
page carries the same pair at its head, so a file read on its own still
says which machine and which tree.

> **Andy:** *"our buddy on WSL should repeat all our measurements for his
> tagged os, and be permitted to contribute it to
> `./measurements/ubuntu-24.05/` so that our CAPACITY.md can illustrate
> the differences."*

```
node spirit/test/measurePlatform.js
```

**One command, both halves.** It runs the harness, then the capacity
measurement, and writes them into `README/CAPACITY/<platform>/` under one
date and one commit — so a green run and a cost figure cannot end up
describing two different trees while looking like one report.

*(`measureCapacity.js --save` still does the capacity half alone, if that
is all you want.)*

**Rename the directory to the distribution if that is more honest** —
`ubuntu-24.05` says more than `linux-6.6`, and add `-wsl2` if that is what
it is.

**A red suite on a new platform is the most valuable thing this produces**,
which is why the whole harness output is kept in `harness.txt` rather than
just its count.

### What may be set side by side, and what may not

| | across platforms |
|---|---|
| disc, bytes per row | **comparable** — a row in SQLite is a fact about the schema |
| process RSS, per-stream slope | **comparable, and they differ** — 60 KB against 40.5 KB a stream, which is the platform and not the measurement |
| **the kernel column** | **not comparable at all** — Windows reports every driver on the box, Linux reports the TCP stack alone |

**The last row is why the table has a column per platform and not an
average.** Two different quantities wearing one name is the worst thing
this page could do, and putting them in one cell would do it.

**And the reason none of this is housekeeping:** if
`ramLimitMB × STREAMS_PER_MB` is the whole governor, that constant had
better be the one for the platform the relay is on. One box cannot say
whether it travels. Two can say whether it is close.

[The conventions, and the caveats that travel with every row.](CAPACITY/README.md)

## What the kernel costs — and why that question has no answer yet

> **Andy:** *"for every possible live member, we must leave space for the
> OS's socket usage etc, which i estimate will be proportional to
> max-live-streams."*

**The instinct is right. The number is not available**, and this section
used to claim otherwise.

**What it said:** ~14 KB of kernel per stream on Windows, so a total of
~75 KB, so `STREAMS_PER_MB` should be ~14.

**What two runs on the same box at the same commit actually gave:**

| | run 1 | run 2 |
|---|---|---|
| per stream, process | 61,450 B | 62,628 B — **2% apart** |
| per stream, kernel | 21,002 B | **48,184 B — 2.3× apart** |

**The process figure is a measurement. The kernel figure is not.** It is
system-wide non-paged pool, so it moves with whatever else the machine is
doing — and a quantity that swings by more than itself between two
identical runs cannot carry a conclusion.

**And Linux fails the same question from the opposite end.**
`/proc/net/sockstat` reports in pages; across 800 streams it moved once,
and a second run reported zero. Too coarse there, too noisy here.

**So the honest position is:**

| | |
|---|---|
| what a stream costs the **process** | **measured** — 61–63 KB Windows, 40–43 KB Linux, stable across runs |
| what a stream costs the **kernel** | **not measurable with these counters**, on either platform |
| therefore the **total** | **unknown**, and no figure on this page should claim one |

### Which is the real argument for Andy's safety factor

> **Andy:** *"we should recommend that on a box of spirit-size only half
> of ram should be allocated for relay."*

**He proposed that before any of this was measured, and the measurements
have made the case for it better rather than weaker.** Not *"the kernel
costs ~14 KB so leave room for it"* — that was a number that dissolved on
a second look — but:

> **The kernel's share is real, proportional to live streams, and cannot
> be measured with the instruments available. A margin is the honest
> substitute for a number you cannot get.**

So a ceiling should be derived from the **process** cost, which is
measurable, and the owner's `ramLimitMB` should be **at most half the
box**. The margin then covers the kernel's share, the operating system,
and everything else still unmeasured — active streams, fragmentation,
payloads in transit — without pretending any of them has been counted.

**And `STREAMS_PER_MB` is still not one number**, for the reason the second
platform found: 62 KB a stream on Windows against 41 KB on Linux is
~16/MB against ~25/MB, before any margin. That is a platform constant, not
a constant.

## A message in flight, and the thing that turned up instead

Andy asked whether the kernel must also hold a spirit-message per socket.
**It cannot be made to, and the relay is why:** sending a full
`PAYLOAD_MAX` message to each of 400 members got **16 through**.
`DEFAULT_PER_REQUESTER = 16` (`router.js:27`) refused the other 384 before
they reached a socket. The relay's own arithmetic already bounds in-flight
bytes from that direction.

**But forcing the send buffers to fill surfaced something else.** The
fixture used raw sockets that never read — and the *idle* kernel cost per
stream went from ~14 KB to **~194 KB**.

**A member who has stopped reading is up to an order of magnitude more
expensive than one who has not**, and nothing caps it, because it is not a
request. It is a socket doing nothing, slowly. That figure is an upper
bound on a noisy system-wide counter with both endpoints local, so the
shape is right and the number is not — but the shape is the part that
matters for a relay whose first duty is to survive.

**Logged as its own hazard** rather than folded into the Governor's
brief: it is a different problem from the one the Governor was built for.

**And the kernel was the smaller half (R35, closed).** Past the kernel's
buffer, Node kept every further write in the relay's own process, with no
limit: 50 MB for one reader on a real socket, before the fix. A stream now
holds at most **2 × 98,816 B ≈ 193 KB** in the process (`limits.js`,
`STREAM_BACKLOG_MAX`) and is cut past it. So the worst a member who has
stopped reading can cost the relay is the kernel's share above plus that,
and it is bounded again. The per-stream figures on this page are for
readers that read.

## What the second platform caught

**Two boxes found two things, and only one of them was the thing we went
looking for.**

### 1. The per-stream cost does not travel

| a held connection costs | Windows 11 | Ubuntu 24.04 (WSL2) |
|---|---|---|
| in the relay process | **60.0 KB** | **40.5 KB** |
| bare `node` RSS | 51.2 MB | 44.5 MB |
| relay at rest | 61.9 MB | 66.3 MB |

**A third fewer bytes a connection**, confirmed by a second run at 43 KB —
stable to a couple of KB, so the gap is real and not noise. It is also
past the *"a 20% gap may be the platform and may be the measurement"*
allowance this page used to make, which is corrected below.

**`STREAMS_PER_MB = 16` implies 64 KB a stream.** Close to the Windows
figure and about **50% pessimistic on Linux** — so a relay on the platform
that actually matters would refuse connections it could comfortably hold.
**One constant for both platforms is wrong**, and that is a design finding
rather than a measurement detail: if `ramLimitMB × STREAMS_PER_MB` is to
become the whole governor, the constant has to come from the platform the
relay is on.

### 2. The Linux kernel column is below measurement resolution

`/proc/net/sockstat` TCP `mem` reports in **pages**. Across 800 streams it
moved **once** — flat for 0, 100, 200 and 400, then a single step at 800.
A second run reported zero.

**So "~1 KB per stream" on Linux is a quantisation floor, not a figure.**
Read it as *below what this counter can see*. The Windows number (~14 KB
of non-paged pool) has no Linux counterpart to be compared with, which is
a stronger statement than the one this page made before.

### 3. And the agreement caught a defect in the tool

**The disc rows matched to the byte** — member 197, partner 279, peer row
157, log entry 253 — which is the schema speaking on both boxes. That
agreement is what exposed the problem: **157 bytes was the wrong number to
be agreeing about.**

Cycle 3 moved `at` and `url` out of the peer row into `seen_routes`, and
the measurement kept passing them to `seen.put`, **which now ignores
them**. Nothing failed. The figure simply fell from 222 to 157 bytes and
every *"N peers in X MB"* claim on this page quietly improved.

**A peer you can actually reach costs 157 + 420 = 577 bytes.** So the peer
figures here were **2.6× optimistic** and are corrected throughout: 10 MB
holds ~18,000 reachable peers rather than ~47,000, and the 20 MB default
is a large town rather than a small city.

*The two-platform run did not find this by disagreeing. It found it by
agreeing about something that should have moved.*

### Still to come

The Ubuntu figures above are **quoted from a run whose files are not yet
in this repository** — the WSL box has no push credentials, and the commit
is sitting on its local `master`. When it lands, the table at the top of
this page picks it up on its own, because that table is generated from the
directories that exist rather than typed.

## What is still not measured

- **An active stream**, as opposed to a held one. Everything here is idle
  connections; one with a payload in flight costs more, and how much more
  is unknown.
- **Linux.** These are Windows numbers, read from `WorkingSet64`. The
  relays that matter run on Linux, where Node's resident footprint
  differs.
- **Bandwidth.** [design/relay/CAPACITY.md](../design/relay/CAPACITY.md)
  argues a relay is bounded by RAM *and* by network throughput. Only the
  first has been measured.
- **What happens at the ceiling.** ~700 is where the arithmetic runs out,
  not where anything was observed to fail.

---

## Method, and why each choice

**RSS, not `heapUsed`.** A held connection's cost is mostly *not* on the
V8 heap — socket buffers belong to the kernel. `heapUsed` gives a
flattering number that answers the wrong question. RSS answers *"will this
box run out"*.

**A slope, not a difference.** GC timing makes any single reading
meaningless. The first version of the tool took one sample per step and
two runs disagreed by 15%, with one step reading *lower* than the step
before it. It takes a median of three spaced samples now.

**The file, not an estimate.** Row costs are measured by differencing a
real database rather than by adding up field widths, because a label is
free-form and a row is not a fixed size. An earlier estimate in
`design/relay/SHADOW-PEER-LIST.md` was 2.7× too pessimistic and is struck
there.

**What git ships, not the working tree.** The install size counts tracked
files; a working tree also holds media, lab nodes and state.

---

## Tracked over time — "tag the tree"

> **Andy:** *"that looks very impressive. lets keep track of this every
> time i say 'tag the tree'."* — *"with an are-you-sure feedback"*

**These numbers are only worth anything if drift is visible.** A measured
figure written once is a figure that goes quietly wrong when the platform
moves, the runtime is upgraded, or the code grows a cost nobody costed.

### What the command does

On **"tag the tree"**, and not otherwise:

1. **Ask first, and say what it would mean today.** Not a prompt — a
   judgement, made at that moment, about this tag.
2. `node spirit/test/measureCapacity.js --row` — one line.
3. Append it to the table below and commit it.
4. Cut an annotated git tag, `capacity-YYYY-MM-DD`, so the row and the
   tree it describes are the same point.

### What step 1 has to carry

> **Andy:** *"your are-you-sure should be commented with an honest
> assessment of the consequences at the time.... also not taken
> lightly."*

**A confirmation that is always the same question trains the answer.**
Asked identically every time, "are you sure?" becomes a keystroke, and
then it is worse than no gate at all — it costs a turn and stops nothing.

So the ask states, **for that occasion**:

- **what has actually changed** since the last row, and whether it is the
  kind of change that would move a number
- **what the row would show** — drift, or measurement noise wearing the
  costume of drift
- **what the tag costs**: it is pushed, other people see it, and deleting
  one is a worse act than never making it
- **a recommendation, including "not yet"** — the assessment is only
  worth reading if it is sometimes negative

**Two rows taken minutes apart do not show drift.** They show noise, and
a history that carries noise as though it were signal is worse than a
history with one honest entry. That is the first thing to check and
usually the answer.

### The history

Read the columns across, not down: a row is one machine on one day, and
**the RSS figures are not portable**. A row from Linux and a row from
Windows are two measurements of two different things, which is why the
platform travels with each.

| date | commit | platform / node | per stream | bare node | relay at rest | node at rest | member / peer row | install |
|---|---|---|---|---|---|---|---|---|
| 2026-09-21 | `e96c904` | win32 / v24.20.0 | 58 KB | 49 MB | 59 MB | 72 MB | 197 / 222 B | 3756 KB |
| 2026-09-21 | `dc21575` | win32 / v24.20.0 | 63 KB | 49 MB | 60 MB | 73 MB | 197 / **577** B¹ | 3797 KB |

**The first row is the baseline**, taken the day the measurement was
built.

**¹ The second row's peer figure changed meaning, not cost.** At `e96c904`
a peer was one row with its route inline, 222 bytes. Cycle 3 (R29) moved
routes into their own table, keyed by peer, my relay and their relay; the
figure since is a name **plus** one route — 577 bytes — and it is the first
time the measurement counted a reachable peer properly. Read the jump as
a better question being asked, not a cost that went up 2.6×.

**What else moved between the two:** install +41 KB (`nodeStore`,
`spiritErrors`, `nodeSettings` and a longer README); node at rest +1 MB
from the modules it now loads. Per-stream 58 → 63 KB is inside the
57–63 KB spread every Windows run today has shown, and no code that holds
a connection changed — noise, not drift.

**Tagged `capacity-2026-09-21`** — the first *capacity* tag (the repository already had fourteen others; an earlier draft of this line said "the first tag on the repository", which was not checked and was wrong), on
Andy's *"tag the tree"*, after an assessment that this interval was real:
cycles 3 and 4 reshaped the data a peer costs.

### The post queue moved into `node.db` (cycle R16)

**An empty `node.db` is now 52 KB, up from 20**, because it holds two more
tables and their indexes. A fixed cost of 32 KB, paid once. (56 KB since
R38 added the partial index on chosen rows: one more page.)

**And the cache cap stopped measuring the file.** It measured
`page_count × page_size` — the whole of `node.db` — which was right while
the file held only the cache. With the queue beside it, a backed-up queue
would have evicted peers to make room for itself, and at the 1 MB floor
could have emptied the cache entirely. The cap now reads the cache's own
tables from SQLite's `dbstat`, so *"maximum cache size"* means the cache
and nothing else. The file's own size is still kept honest by the vacuum.
