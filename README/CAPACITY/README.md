# Measurements, one directory per platform

> **Andy:** *"our buddy on WSL should repeat all our measurements for his
> tagged os, and be permitted to contribute it to
> `./measurements/ubuntu-24.05/` so that our CAPACITY.md can illustrate
> the differences."* — *"or under README/CAPACITY/"*

**Every figure in [CAPACITY.md](../CAPACITY.md) is the
machine it was taken on.** The numbers there were measured on Windows, and
the relays that matter run on Linux — so the document is honest about one
box and silent about the one people will deploy. This directory is where
a second box gets a voice.

## Contributing a platform

```
node spirit/test/measurePlatform.js
```

**One command for the whole story.** It runs the harness, then the
capacity measurement, and writes four files into
`README/CAPACITY/<platform>/`:

| | |
|---|---|
| `platform.md` | the page a person reads — both halves, one date, one commit |
| `harness.json` | the counts, machine-readable |
| `harness.txt` | **the whole harness output**, because a red suite on a new box is the most useful thing here |
| `capacity.json` / `capacity.md` | what the box holds, and how it was measured |

*(`measureCapacity.js --save` does the capacity half alone, if that is all
you want.)*

**They are run in sequence on purpose.** Taken an hour apart, a green
harness and a cost figure can describe two different trees while looking
like one report.

**Name the directory yourself** — the automatic name is the kernel
(`linux-6.18`), and what a reader needs is the distribution and whether it
is WSL:

```
node spirit/test/measurePlatform.js --as ubuntu-24.04-wsl2
```

Renaming by hand after a run works too, and is a step that eventually gets
skipped — leaving one machine with two directories and one of them stale.

**Commit both files.** The JSON is what a comparison is built from; the
markdown is what a person reads.

## Comments are not stripped from deliverables — decided, with the numbers

**Asked and answered 2026-09-23.** Andy: *"what do those figures look like
minimized, stipped of comments etc? does that affect memory usage?"* — and
on the result: *"no. we won't strip comments from diliverables. agreed."*

It is written down because the question will be asked again by anyone who
measures this tree and finds that **67% of `spirit/run/js` is comment**
(880 KB of 1,320 KB, 54 files). That is a startling ratio and it invites
an obvious-looking saving.

**Measured rather than argued**, loading the nineteen modules a relay
loads, three runs each, on Windows:

| | rss | heap |
|---|---|---|
| bare `node`, nothing loaded | 59.1 MB | — |
| with comments | 68.6 MB | 7.36 MB |
| comments stripped | 67.1 MB | 6.08 MB |
| **saved** | **1.57 MB (2.3%)** | **1.28 MB (17%)** |

So it is real: V8 retains script source, and 880 KB of text costs about
1.3 MB of heap — roughly 1.45x its byte count, with overhead. Against our
OWN footprint it is larger than it looks: the bare-node floor is 59 MB, so
SpiritOS adds 9.6 MB with comments and 8.0 MB without, and stripping would
cut our share by about a sixth.

**And it is still the wrong trade.**

- **It does not touch the thing that moves.** Node-at-rest rose 16 MB in
  one cycle (73.0 -> 89.2 MB on Windows, 84.5 -> 100.9 MB on Ubuntu).
  Stripping every comment in the tree recovers a tenth of that. The growth
  is objects, not text.
- **The floor is not ours.** 59 MB is `node` before a line of this runs —
  88% of a relay's resident memory. Serious memory work is about the
  runtime, not the source.
- **A running relay is sockets, not source.** At 52 KB a held connection,
  thirty connected members outweigh every comment in the repository.
- **The comments are a deliverable.** This project ships explanation as
  product — the hello-world sample is ten lines of code and about 150 of
  comment by design. Trading that for 2% of resident memory is a bad
  trade, and a relay whose source cannot be read is a relay nobody can
  audit.

**If it ever does matter**, the shape is: strip at install time, for a
relay only, never in the repository and never for a node a developer
reads. A relay is the memory-constrained box and nobody reads its source
in place. Nothing today justifies building that.

## What may be compared, and what may not

**Comparable across platforms:** the disc figures. A row in SQLite is a
row in SQLite, and 197 bytes for a member is a fact about the schema.

**Comparable, and they differ — corrected 2026-09-21.** This said *"a 20%
gap between two boxes may be the platform and may be the measurement"*.
The first two boxes came in at **60 KB and 40.5 KB** a stream, a third
apart, stable across runs. The gap is the platform. Compare these, expect
them to differ, and do not average them into a constant.

**Do not use the kernel column at all.** It is in the JSON because the
tool reads it, and it is in no table on this page because neither platform
can measure it:

- **Windows** — system-wide non-paged pool. Two runs on one box at one
  commit gave 21,002 and 48,184 bytes a stream. It moves with whatever
  else the machine is doing.
- **Linux** — `/proc/net/sockstat` in pages. It moved once across 800
  streams and a second run reported zero, so a small figure there means
  *below what the counter can see* rather than *small*.

**A margin is the honest substitute.** The kernel's share is real and
proportional to live streams; it simply cannot be counted with these
instruments, so a ceiling is derived from the process cost and the owner
gives a relay at most half the box. Windows reports non-paged
pool, which is *every driver on the machine*. Linux reports
`/proc/net/sockstat` TCP `mem`, which is *the TCP stack alone*. These are
different quantities with the same name, and averaging them or putting
them in one column without a label would be the worst thing this
directory could do.

## The caveats that travel with every row

Each `capacity.json` carries them, so nobody has to remember:

- **loopback** — both socket endpoints are on the measuring machine, so
  the kernel share is an upper bound for a relay holding one end per
  member
- **idle streams only** — an active stream costs more, and by how much is
  unmeasured on every platform so far
- **the kernel counter is not per-process** and carries whatever else the
  machine was doing

## Why a second platform is the point

**The per-stream total is what every hard ceiling is derived from.** If
`ramLimitMB × STREAMS_PER_MB` is the whole governor, then
`STREAMS_PER_MB` had better be the number for the platform the relay is
actually on — otherwise an owner sets 128 MB and the arithmetic promises
something the box cannot carry.

One platform cannot tell you whether that constant is portable. Two can
tell you whether it is even close.

---

## Why a subfolder per platform, and not one file

> **Andy:** *"syncing commits of those subfolders among my machines will
> automatically generate a kind of history as well."*

**Because one machine writes one directory, two machines never collide.**
There is no shared file to merge, no ordering to agree on, and no
coordination: a box measures itself, commits its own folder, and pushes.
Whoever pulls has both.

**And git is then the history, for free.** `git log README/CAPACITY/<platform>/`
is every measurement that box has ever contributed, with its date and the
tree it was taken against — maintained by nobody.

**So there are two histories and they are not redundant.** The table at
the foot of [CAPACITY.md](../CAPACITY.md) is the one a person reads at a
glance, added to deliberately when Andy says *"tag the tree"*. The git log
is complete, automatic, and per machine. The first is a summary somebody
chose; the second is the record.

## The same shape, elsewhere

> **Andy:** *"we'll do something similar under README/HARNESS/REPORT."*

**Not built.** The convention is meant to repeat: a tool writes
`<topic>/<machine>/`, each machine owns its directory, the parent document
fans out to them, and the history is whatever git already keeps. Nothing
here is specific to capacity except the numbers.

---

## What comparing two harness runs found

**The counts differed — 2,665 on Windows against 2,671 on Ubuntu — and
both explanations were worth having.**

### `shutdownWire.js`: 2 on Windows, 9 on Ubuntu

**Deliberate, and the suite says so.** Windows' `child.kill()` is
`TerminateProcess`, so a SIGTERM handler never runs; the suite skips the
wire half and falls back to reading the two startup files for the
handler's registration — *"a guard against it being deleted, not proof
that it works."*

**So the Ubuntu run is the first time those seven checks have ever
executed.** The relay's goodbye-on-shutdown had been written, guarded and
never once proven on a wire, because this project had only ever run on
Windows.

### `writableRoots.js`: 13 on Windows, 12 on Ubuntu

**Not a platform difference at all.** `preferences.json` is untracked, so
a box where the node has run has one and a fresh clone does not — and the
branch that handles its absence was **silent**, so the count moved without
saying why.

Fixed by making that branch report like every other. **The suite was right
and the count was misleading**, which matters more now that two machines
compare their output: a silent difference reads as a platform difference,
and this one was a fact about the checkout.

### The moral, for whoever compares the next pair

**A count that differs is a question, not a fault.** One of these was a
documented platform limit worth knowing about, one was a test that did
work without reporting it. Neither was a bug in the product, and both were
only visible because two boxes ran the same suites and wrote the numbers
down.

---

## Notes from running this on a second box

**Two things cost time to work out once. They are here so they cost
nobody time twice.**

### The capacity half got slower, and the harness was not why

The WSL run reported the capacity half taking **209 s**, against about a
minute for the standalone tool the same box had run earlier, and
reasonably wondered whether it was waiting for the harness's processes to
wind down.

**It was not.** Two measurement loops were added to the tool between those
two runs: **5,000 route-row writes** — each one followed by a trim query
that re-ranks the peer's routes — and **2,000 traffic-log entries**.

**The control is Windows**, which took 159 s both standalone and
orchestrated. Same tool, same additions, no change when run after the
harness. So the extra time is work the tool now does, not contention with
what ran before it.

*Worth knowing rather than fixing: the trim query runs once per route
written, which is the slowest thing in the measurement and is fine for a
tool nobody runs in a loop.*

### Pushing from WSL

The push worked through **VS Code's own git askpass socket**, which was
already live and signed in — no token or key was stored on the box.

**Two consequences.** A push from a plain WSL shell, outside VS Code, will
still fail. And **the socket name changes whenever VS Code restarts**, so
find it with a glob rather than hard-coding it:

```
/run/user/1000/vscode-git-*.sock
```

*(Found by the WSL session, on its second pass. The first run hard-coded
the name and it had already changed.)*

### The icons are emoji, and a fresh Linux has no emoji font

**Found on 2026-09-21**, the first time a node's shell was opened in Chrome
on WSL. Functionally everything worked — two nodes on two operating
systems added each other through spirit-3, instantly — but the icons did
not render.

**All 162 of them are Unicode emoji** (`kernel.js`, `ICON`): `🟢`, `✅`,
`⚠️`. Windows and macOS ship a colour emoji font; a fresh Ubuntu, and
most minimal Linux installs, do not.

```
sudo apt install fonts-noto-color-emoji
fc-cache -f
```

and restart the browser completely. **Verified on the WSL box the same day**: `fc-list | grep -i emoji` printed nothing before the install, and the icons rendered after it.

**It is a requirement of the machine running the BROWSER, not the node** —
a node on a headless server is unaffected, and the shell viewed from a
Windows or Mac browser renders correctly whatever the node runs on. Worth
knowing before anybody reads blank squares as a broken UI.
