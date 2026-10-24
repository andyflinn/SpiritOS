# Capacity on `linux-6.18`

**Measured 2026-10-24, against `a6d9a372`.**

| | |
|---|---|
| platform | linux 6.18.33.2-microsoft-standard-WSL2 |
| version | #1 SMP PREEMPT_DYNAMIC Thu Jun 18 21:54:43 UTC 2026 |
| node | v24.21.0 |
| cpus / ram | 32 / 64148 MB |
| measured at | 2026-10-24T14:23:56.071Z |
| tree | `a6d9a372` |

*Read [the conventions](../README.md) before comparing this with
another platform — the kernel column in particular is not the same
quantity on two operating systems.*

---


measured 2026-10-24, against `a6d9a372`
on linux, Node v24.21.0

| minimum to run | |
|---|---|
| Node.js | **22.13 or later** (`node:sqlite`, which both stores need) |
| dependencies | **none** — built-ins only, no `npm install` |
| RAM, personal node | **85 MB** at rest |
| RAM, relay | **61 MB** at rest, before any connection |
| disc, the install | **4310 KB** in 369 files |

| fixed cost | RSS |
|---|---|
| bare `node`, nothing loaded | **42 MB** |
| a personal node at rest | **85 MB** |
| a relay at rest, 0 streams | **61 MB** |
| — of which SpiritOS | ~18 MB |

| streams | RSS | over baseline | per stream |
|---|---|---|---|
| 0 | 61 MB | — | — |
| 100 | 61 MB | 0 MB | 0 KB |
| 200 | 61 MB | 0 MB | 0 KB |
| 400 | 61 MB | 0 MB | 0 KB |
| 800 | 61 MB | 0 MB | 0 KB |

**~0 KB per held stream in the process**, from the slope of the last segment (the 100→200 segment reads 0 KB, which is the spread to expect).
`STREAMS_PER_MB = 16` implies 64 KB, so the guess is 100% pessimistic.

| disc | bytes per row |
|---|---|
| relay: a member | **603** |
| node: a remembered peer, no route | **165** |
| node: one route for that peer | **420** |
| **node: a peer you can reach** | **585** |
| node: one logged exchange | **295** synthetic — a real one averages **438**, see below |
| an empty `relay.db` / `node.db` | 32 KB / 136 KB |

| the two boxes | |
|---|---|
| relay, 100 MB RAM | **~Infinity members connected at once** (39 MB headroom / 0 KB) |
| relay, 1 GB disc | **~1.8M member rows** |
| node, 1 MB RAM | **not possible** — bare Node.js is 42 MB |
| node, 10 MB disc | **~17,924 remembered peers** |
| node, 1 GB disc | **~2.5M logged exchanges** kept for ever — the cache cap (20 MB) is 2% of it |

