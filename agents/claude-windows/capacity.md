# Capacity on `windows-10.0`

**Measured 2026-10-04, against `3ce4152f`.**

| | |
|---|---|
| platform | win32 10.0.26200 |
| version | Windows 11 Pro |
| node | v24.20.0 |
| cpus / ram | 32 / 130767 MB |
| measured at | 2026-10-04T22:38:24.871Z |
| tree | `3ce4152f` |

*Read [the conventions](../README.md) before comparing this with
another platform — the kernel column in particular is not the same
quantity on two operating systems.*

---


measured 2026-10-04, against `3ce4152f`
on win32, Node v24.20.0

| minimum to run | |
|---|---|
| Node.js | **22.13 or later** (`node:sqlite`, which both stores need) |
| dependencies | **none** — built-ins only, no `npm install` |
| RAM, personal node | **86 MB** at rest |
| RAM, relay | **70 MB** at rest, before any connection |
| disc, the install | **3585 KB** in 188 files |

| fixed cost | RSS |
|---|---|
| bare `node`, nothing loaded | **59 MB** |
| a personal node at rest | **86 MB** |
| a relay at rest, 0 streams | **70 MB** |
| — of which SpiritOS | ~11 MB |

| streams | RSS | over baseline | per stream |
|---|---|---|---|
| 0 | 70 MB | — | — |
| 100 | 70 MB | 1 MB | 8 KB |
| 200 | 76 MB | 6 MB | 31 KB |
| 400 | 91 MB | 22 MB | 56 KB |
| 800 | 115 MB | 45 MB | 58 KB |

**~60 KB per held stream in the process**, from the slope of the last segment (the 100→200 segment reads 54 KB, which is the spread to expect).

**And ~11 KB more in the kernel**, which no RSS figure can see — non-paged pool, system-wide, so every driver on the box is in it. **On loopback both endpoints are local**, so a real relay holding one end per member spends nearer half of it.

So the figure a ceiling should be derived from is the **total**, ~71 KB — not the process cost alone, or an owner's `ramLimitMB` quietly means something other than what they set.
`STREAMS_PER_MB = 16` implies 64 KB, so the guess is 6% pessimistic.

| disc | bytes per row |
|---|---|
| relay: a member | **603** |
| relay: a partner | **3293** |
| node: a remembered peer, no route | **159** |
| node: one route for that peer | **420** |
| **node: a peer you can reach** | **579** |
| node: one logged exchange | **295** synthetic — a real one averages **438**, see below |
| an empty `relay.db` / `node.db` | 40 KB / 124 KB |

| the two boxes | |
|---|---|
| relay, 100 MB RAM | **~520 members connected at once** (30 MB headroom / 60 KB) |
| relay, 1 GB disc | **~1.8M member rows**, or ~0.3M partner rows |
| node, 1 MB RAM | **not possible** — bare Node.js is 59 MB |
| node, 10 MB disc | **~18,110 remembered peers** |
| node, 1 GB disc | **~2.5M logged exchanges** kept for ever — the cache cap (20 MB) is 2% of it |

