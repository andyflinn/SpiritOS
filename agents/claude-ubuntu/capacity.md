# Capacity on `linux-7.0`

**Measured 2026-10-04, against `3ce4152f`.**

| | |
|---|---|
| platform | linux 7.0.0-15-generic |
| version | #15-Ubuntu SMP PREEMPT_DYNAMIC Wed Apr 22 16:06:43 UTC 2026 |
| node | v22.23.3 |
| cpus / ram | 6 / 7274 MB |
| measured at | 2026-10-04T22:27:46.829Z |
| tree | `3ce4152f` |

*Read [the conventions](../README.md) before comparing this with
another platform — the kernel column in particular is not the same
quantity on two operating systems.*

---


measured 2026-10-04, against `3ce4152f`
on linux, Node v22.23.3

| minimum to run | |
|---|---|
| Node.js | **22.13 or later** (`node:sqlite`, which both stores need) |
| dependencies | **none** — built-ins only, no `npm install` |
| RAM, personal node | **0 MB** at rest |
| RAM, relay | **63 MB** at rest, before any connection |
| disc, the install | **3516 KB** in 188 files |

| fixed cost | RSS |
|---|---|
| bare `node`, nothing loaded | **42 MB** |
| a personal node at rest | **0 MB** |
| a relay at rest, 0 streams | **63 MB** |
| — of which SpiritOS | ~20 MB |

| streams | RSS | over baseline | per stream |
|---|---|---|---|
| 0 | 63 MB | — | — |
| 100 | 72 MB | 9 MB | 94 KB |
| 200 | 70 MB | 7 MB | 35 KB |
| 400 | 75 MB | 12 MB | 32 KB |
| 800 | 87 MB | 24 MB | 31 KB |

**~30 KB per held stream in the process**, from the slope of the last segment (the 100→200 segment reads -25 KB, which is the spread to expect).

**And ~-3 KB more in the kernel**, which no RSS figure can see — /proc/net/sockstat TCP `mem`, the TCP stack alone. **On loopback both endpoints are local**, so a real relay holding one end per member spends nearer half of it.

So the figure a ceiling should be derived from is the **total**, ~27 KB — not the process cost alone, or an owner's `ramLimitMB` quietly means something other than what they set.
`STREAMS_PER_MB = 16` implies 64 KB, so the guess is 53% pessimistic.

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
| relay, 100 MB RAM | **~1268 members connected at once** (37 MB headroom / 30 KB) |
| relay, 1 GB disc | **~1.8M member rows**, or ~0.3M partner rows |
| node, 1 MB RAM | **not possible** — bare Node.js is 42 MB |
| node, 10 MB disc | **~18,110 remembered peers** |
| node, 1 GB disc | **~2.5M logged exchanges** kept for ever — the cache cap (20 MB) is 2% of it |

