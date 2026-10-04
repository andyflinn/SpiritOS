# Capacity on `linux-6.18`

**Measured 2026-10-04, against `3ce4152f`.**

| | |
|---|---|
| platform | linux 6.18.33.2-microsoft-standard-WSL2 |
| version | #1 SMP PREEMPT_DYNAMIC Thu Jun 18 21:54:43 UTC 2026 |
| node | v24.21.0 |
| cpus / ram | 32 / 64148 MB |
| measured at | 2026-10-04T22:41:43.584Z |
| tree | `3ce4152f` |

*Read [the conventions](../README.md) before comparing this with
another platform — the kernel column in particular is not the same
quantity on two operating systems.*

---


measured 2026-10-04, against `3ce4152f`
on linux, Node v24.21.0

| minimum to run | |
|---|---|
| Node.js | **22.13 or later** (`node:sqlite`, which both stores need) |
| dependencies | **none** — built-ins only, no `npm install` |
| RAM, personal node | **97 MB** at rest |
| RAM, relay | **62 MB** at rest, before any connection |
| disc, the install | **3516 KB** in 188 files |

| fixed cost | RSS |
|---|---|
| bare `node`, nothing loaded | **42 MB** |
| a personal node at rest | **97 MB** |
| a relay at rest, 0 streams | **62 MB** |
| — of which SpiritOS | ~20 MB |

| streams | RSS | over baseline | per stream |
|---|---|---|---|
| 0 | 62 MB | — | — |
| 100 | 75 MB | 12 MB | 127 KB |
| 200 | 80 MB | 18 MB | 90 KB |
| 400 | 84 MB | 22 MB | 57 KB |
| 800 | 101 MB | 39 MB | 50 KB |

**~42 KB per held stream in the process**, from the slope of the last segment (the 100→200 segment reads 53 KB, which is the spread to expect).
`STREAMS_PER_MB = 16` implies 64 KB, so the guess is 34% pessimistic.

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
| relay, 100 MB RAM | **~915 members connected at once** (38 MB headroom / 42 KB) |
| relay, 1 GB disc | **~1.8M member rows**, or ~0.3M partner rows |
| node, 1 MB RAM | **not possible** — bare Node.js is 42 MB |
| node, 10 MB disc | **~18,110 remembered peers** |
| node, 1 GB disc | **~2.5M logged exchanges** kept for ever — the cache cap (20 MB) is 2% of it |

