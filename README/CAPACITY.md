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

| RAM | a relay holds, connected at once |
|---|---|
| 64 MB | 70 — **too tight to mean anything**, 60 MB is gone at rest |
| 100 MB | ~700 |
| **128 MB** | **~1,200** |
| 256 MB | ~3,500 |
| 512 MB | ~8,000 |

**It is a straight line above the floor**, because a held connection costs
~58 KB and nothing else about a relay grows with use. Below ~64 MB there
is no line at all: the fixed cost has eaten the box.

**A node does not have this table**, because a node does not hold
hundreds of connections — it holds one per relay it is a member of. Its
128 MB buys headroom for the shell, the apps and the job system, not
concurrency.

### A relay with 100 MB RAM and 1 GB disc

```
100 MB   total
- 49 MB  Node.js itself
- 11 MB  the relay
= 41 MB  left for connections
/ 58 KB  per held stream
= ~700 members connected at once
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
| remembered peers, at 222 B each | **~47,000** in 10 MB |
| an empty `node.db` | 20 KB |
| contacts, identity, relay pins | kilobytes |
| the traffic log | grows with what you actually send, and is permanent by decision |

**But the shipped peer-cache default is 20 MB, which does not fit.** That
is not a flaw in the example — it is the case the owner's cap exists for.
A node on a 10 MB disc sets its cache to 2 MB and remembers 9,000 people,
which is still more than anyone meets.

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
| **the peer cache, at its 20 MB default** | 20 MB ≈ 93,000 people | **2%** |
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
| **the auto-memory** | `relay-state/node.db` | **20 KB** here, **capped at 20 MB** by default |
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
capped**, it evicts oldest-first, and at 222 bytes a peer the 20 MB
default is about 93,000 people — *"a small city"*. Nothing you do makes
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
| node: a remembered peer | **222** |
| node: one logged exchange | **438** |
| an empty `relay.db` / `node.db` | 40 KB / 20 KB |

**The log entry is the one number here taken from a real file rather than
a generated one.** 695 actual entries on a working node average 438 bytes;
the tool's own synthetic entries come to 253, because they carry a short
relay URL and no label. The tool reports both and this page uses the real
one — a measurement of traffic nobody sent is a floor, not a figure.

**Disc is not what bounds a relay.** A gigabyte is 5.5 million members. A
relay runs out of RAM, of bandwidth, or of its owner's patience long
before it runs out of room to write people down.

---

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

**The first row is the baseline**, taken the day the measurement was
built. Nothing is being compared yet — which is the honest state of a
history with one entry in it.
