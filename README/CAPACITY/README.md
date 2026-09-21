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
node spirit/test/measureCapacity.js --save
```

It writes `README/CAPACITY/<platform>/capacity.json` and `capacity.md` —
beside the document they are for. The directory is named from
`os.release()`, so **rename it to the distribution if that is more
honest**: `ubuntu-24.05` says more than `linux-6.6`.

**Commit both files.** The JSON is what a comparison is built from; the
markdown is what a person reads.

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
