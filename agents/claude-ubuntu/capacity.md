# Capacity on `linux-7.0`

**Measured 2026-10-24, against `7df82fff`.**

| | |
|---|---|
| platform | linux 7.0.0-38-generic |
| version | #38-Ubuntu SMP PREEMPT_DYNAMIC Fri Sep  4 09:10:14 UTC 2026 |
| node | v22.23.3 |
| cpus / ram | 6 / 7274 MB |
| measured at | 2026-10-24T12:41:52.006Z |
| tree | `7df82fff` |

*Read [the conventions](../README.md) before comparing this with
another platform — the kernel column in particular is not the same
quantity on two operating systems.*

---


measured 2026-10-24, against `7df82fff`
on linux, Node v22.23.3

| minimum to run | |
|---|---|
| Node.js | **22.13 or later** (`node:sqlite`, which both stores need) |
| dependencies | **none** — built-ins only, no `npm install` |
| RAM, personal node | **78 MB** at rest |
| RAM, relay | **62 MB** at rest, before any connection |
| disc, the install | **4269 KB** in 366 files |

| fixed cost | RSS |
|---|---|
| bare `node`, nothing loaded | **42 MB** |
| a personal node at rest | **78 MB** |
| a relay at rest, 0 streams | **62 MB** |
| — of which SpiritOS | ~19 MB |

| streams | RSS | over baseline | per stream |
|---|---|---|---|
| 0 | 62 MB | — | — |
| 100 | 62 MB | 0 MB | 0 KB |
| 200 | 59 MB | -2 MB | -11 KB |
| 400 | 59 MB | -2 MB | -6 KB |
| 800 | 59 MB | -2 MB | -3 KB |

**~0 KB per held stream in the process**, from the slope of the last segment (the 100→200 segment reads -23 KB, which is the spread to expect).

**And ~0 KB more in the kernel**, which no RSS figure can see — /proc/net/sockstat TCP `mem`, the TCP stack alone. **On loopback both endpoints are local**, so a real relay holding one end per member spends nearer half of it.

So the figure a ceiling should be derived from is the **total**, ~0 KB — not the process cost alone, or an owner's `ramLimitMB` quietly means something other than what they set.
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
| relay, 100 MB RAM | **~Infinity members connected at once** (38 MB headroom / 0 KB) |
| relay, 1 GB disc | **~1.8M member rows** |
| node, 1 MB RAM | **not possible** — bare Node.js is 42 MB |
| node, 10 MB disc | **~17,924 remembered peers** |
| node, 1 GB disc | **~2.5M logged exchanges** kept for ever — the cache cap (20 MB) is 2% of it |

