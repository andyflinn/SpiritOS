# Capacity on `linux-7.0`

**Measured 2026-11-03, against `055402a1`.**

| | |
|---|---|
| platform | linux 7.0.0-38-generic |
| version | #38-Ubuntu SMP PREEMPT_DYNAMIC Fri Sep  4 09:10:14 UTC 2026 |
| node | v22.23.3 |
| cpus / ram | 6 / 7274 MB |
| measured at | 2026-11-03T22:58:59.384Z |
| tree | `055402a1` |

*Read [the conventions](../README.md) before comparing this with
another platform — the kernel column in particular is not the same
quantity on two operating systems.*

---


measured 2026-11-03, against `055402a1`
on linux, Node v22.23.3

| minimum to run | |
|---|---|
| Node.js | **22.13 or later** (`node:sqlite`, which both stores need) |
| dependencies | **none** — built-ins only, no `npm install` |
| RAM, personal node | **88 MB** at rest |
| RAM, relay | **61 MB** at rest, before any connection |
| disc, the install | **6906 KB** in 695 files |

| fixed cost | RSS |
|---|---|
| bare `node`, nothing loaded | **43 MB** |
| a personal node at rest | **88 MB** |
| a relay at rest, 0 streams | **61 MB** |
| — of which SpiritOS | ~19 MB |

| streams | RSS | over baseline | per stream |
|---|---|---|---|
| 0 | 61 MB | — | — |
| 100 | 61 MB | 0 MB | 0 KB |
| 200 | 59 MB | -2 MB | -10 KB |
| 400 | 59 MB | -2 MB | -5 KB |
| 800 | 59 MB | -2 MB | -3 KB |

**~0 KB per held stream in the process**, from the slope of the last segment (the 100→200 segment reads -21 KB, which is the spread to expect).

**And ~0 KB more in the kernel**, which no RSS figure can see — /proc/net/sockstat TCP `mem`, the TCP stack alone. **On loopback both endpoints are local**, so a real relay holding one end per member spends nearer half of it.

So the figure a ceiling should be derived from is the **total**, ~0 KB — not the process cost alone, or an owner's `ramLimitMB` quietly means something other than what they set.
`STREAMS_PER_MB = 16` implies 64 KB, so the guess is 100% pessimistic.

| disc | bytes per row |
|---|---|
| relay: a member | **603** |
| node: a remembered peer, no route | **175** |
| node: one route for that peer | **460** |
| **node: a peer you can reach** | **635** |
| node: one logged exchange | **295** synthetic — a real one averages **438**, see below |
| an empty `relay.db` / `node.db` | 32 KB / 156 KB |

| the two boxes | |
|---|---|
| relay, 100 MB RAM | **~Infinity members connected at once** (39 MB headroom / 0 KB) |
| relay, 1 GB disc | **~1.8M member rows** |
| node, 1 MB RAM | **not possible** — bare Node.js is 43 MB |
| node, 10 MB disc | **~16,513 remembered peers** |
| node, 1 GB disc | **~2.5M logged exchanges** kept for ever — the cache cap (20 MB) is 2% of it |

