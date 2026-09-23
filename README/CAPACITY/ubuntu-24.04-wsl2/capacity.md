# Capacity on `ubuntu-24.04-wsl2`

**Measured 2026-09-23, against `a380af2`.**

| | |
|---|---|
| platform | linux 6.18.33.2-microsoft-standard-WSL2 |
| version | #1 SMP PREEMPT_DYNAMIC Thu Jun 18 21:54:43 UTC 2026 |
| node | v24.21.0 |
| cpus / ram | 32 / 64148 MB |
| measured at | 2026-09-23T22:01:52.177Z |
| tree | `a380af2` |

*Read [the conventions](../README.md) before comparing this with
another platform — the kernel column in particular is not the same
quantity on two operating systems.*

---


measured 2026-09-23, against `a380af2`
on linux, Node v24.21.0

| minimum to run | |
|---|---|
| Node.js | **22.13 or later** (`node:sqlite`, which both stores need) |
| dependencies | **none** — built-ins only, no `npm install` |
| RAM, personal node | **96 MB** at rest |
| RAM, relay | **64 MB** at rest, before any connection |
| disc, the install | **4138 KB** in 124 files |

| fixed cost | RSS |
|---|---|
| bare `node`, nothing loaded | **42 MB** |
| a personal node at rest | **96 MB** |
| a relay at rest, 0 streams | **64 MB** |
| — of which SpiritOS | ~21 MB |

| streams | RSS | over baseline | per stream |
|---|---|---|---|
| 0 | 64 MB | — | — |
| 100 | 78 MB | 14 MB | 144 KB |
| 200 | 81 MB | 17 MB | 85 KB |
| 400 | 86 MB | 22 MB | 56 KB |
| 800 | 105 MB | 41 MB | 53 KB |

**~50 KB per held stream in the process**, from the slope of the last segment (the 100→200 segment reads 27 KB, which is the spread to expect).

**And ~1 KB more in the kernel**, which no RSS figure can see — /proc/net/sockstat TCP `mem`, the TCP stack alone. **On loopback both endpoints are local**, so a real relay holding one end per member spends nearer half of it.

So the figure a ceiling should be derived from is the **total**, ~51 KB — not the process cost alone, or an owner's `ramLimitMB` quietly means something other than what they set.
`STREAMS_PER_MB = 16` implies 64 KB, so the guess is 22% pessimistic.

| disc | bytes per row |
|---|---|
| relay: a member | **603** |
| relay: a partner | **3293** |
| node: a remembered peer, no route | **159** |
| node: one route for that peer | **420** |
| **node: a peer you can reach** | **579** |
| node: one logged exchange | **253** synthetic — a real one averages **438**, see below |
| an empty `relay.db` / `node.db` | 40 KB / 80 KB |

| the two boxes | |
|---|---|
| relay, 100 MB RAM | **~738 members connected at once** (36 MB headroom / 50 KB) |
| relay, 1 GB disc | **~1.8M member rows**, or ~0.3M partner rows |
| node, 1 MB RAM | **not possible** — bare Node.js is 42 MB |
| node, 10 MB disc | **~18,110 remembered peers** |
| node, 1 GB disc | **~2.5M logged exchanges** kept for ever — the cache cap (20 MB) is 2% of it |

