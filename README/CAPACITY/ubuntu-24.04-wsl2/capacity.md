# Capacity on `ubuntu-24.04-wsl2`

**Measured 2026-09-21, against `27374ee`.**

| | |
|---|---|
| platform | linux 6.18.33.2-microsoft-standard-WSL2 |
| version | #1 SMP PREEMPT_DYNAMIC Thu Jun 18 21:54:43 UTC 2026 |
| node | v24.21.0 |
| cpus / ram | 32 / 64148 MB |
| measured at | 2026-09-21T23:08:53.824Z |
| tree | `27374ee` |

*Read [the conventions](../README.md) before comparing this with
another platform — the kernel column in particular is not the same
quantity on two operating systems.*

---


measured 2026-09-21, against `27374ee`
on linux, Node v24.21.0

| minimum to run | |
|---|---|
| Node.js | **22.13 or later** (`node:sqlite`, which both stores need) |
| dependencies | **none** — built-ins only, no `npm install` |
| RAM, personal node | **84 MB** at rest |
| RAM, relay | **63 MB** at rest, before any connection |
| disc, the install | **3835 KB** in 113 files |

| fixed cost | RSS |
|---|---|
| bare `node`, nothing loaded | **42 MB** |
| a personal node at rest | **84 MB** |
| a relay at rest, 0 streams | **63 MB** |
| — of which SpiritOS | ~21 MB |

| streams | RSS | over baseline | per stream |
|---|---|---|---|
| 0 | 63 MB | — | — |
| 100 | 78 MB | 15 MB | 155 KB |
| 200 | 80 MB | 17 MB | 86 KB |
| 400 | 85 MB | 21 MB | 54 KB |
| 800 | 104 MB | 41 MB | 53 KB |

**~51 KB per held stream in the process**, from the slope of the last segment (the 100→200 segment reads 17 KB, which is the spread to expect).
`STREAMS_PER_MB = 16` implies 64 KB, so the guess is 21% pessimistic.

| disc | bytes per row |
|---|---|
| relay: a member | **197** |
| relay: a partner | **279** |
| node: a remembered peer, no route | **159** |
| node: one route for that peer | **420** |
| **node: a peer you can reach** | **579** |
| node: one logged exchange | **253** synthetic — a real one averages **438**, see below |
| an empty `relay.db` / `node.db` | 40 KB / 56 KB |

| the two boxes | |
|---|---|
| relay, 100 MB RAM | **~737 members connected at once** (37 MB headroom / 51 KB) |
| relay, 1 GB disc | **~5.5M member rows**, or ~3.8M partner rows |
| node, 1 MB RAM | **not possible** — bare Node.js is 42 MB |
| node, 10 MB disc | **~18,110 remembered peers** |
| node, 1 GB disc | **~2.5M logged exchanges** kept for ever — the cache cap (20 MB) is 2% of it |

