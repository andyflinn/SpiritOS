# Capacity on `ubuntu-24.04-wsl2`

**Measured 2026-09-21, against `cccb865`.**

| | |
|---|---|
| platform | linux 6.18.33.2-microsoft-standard-WSL2 |
| version | #1 SMP PREEMPT_DYNAMIC Thu Jun 18 21:54:43 UTC 2026 |
| node | v24.21.0 |
| cpus / ram | 32 / 64148 MB |
| measured at | 2026-09-21T16:13:16.908Z |
| tree | `cccb865` |

*Read [the conventions](../README.md) before comparing this with
another platform — the kernel column in particular is not the same
quantity on two operating systems.*

---


measured 2026-09-21, against `cccb865`
on linux, Node v24.21.0

| minimum to run | |
|---|---|
| Node.js | **22.13 or later** (`node:sqlite`, which both stores need) |
| dependencies | **none** — built-ins only, no `npm install` |
| RAM, personal node | **72 MB** at rest |
| RAM, relay | **63 MB** at rest, before any connection |
| disc, the install | **3774 KB** in 110 files |

| fixed cost | RSS |
|---|---|
| bare `node`, nothing loaded | **42 MB** |
| a personal node at rest | **72 MB** |
| a relay at rest, 0 streams | **63 MB** |
| — of which SpiritOS | ~21 MB |

| streams | RSS | over baseline | per stream |
|---|---|---|---|
| 0 | 63 MB | — | — |
| 100 | 77 MB | 14 MB | 144 KB |
| 200 | 80 MB | 17 MB | 85 KB |
| 400 | 84 MB | 21 MB | 54 KB |
| 800 | 101 MB | 38 MB | 48 KB |

**~42 KB per held stream in the process**, from the slope of the last segment (the 100→200 segment reads 26 KB, which is the spread to expect).

**And ~3 KB more in the kernel**, which no RSS figure can see — /proc/net/sockstat TCP `mem`, the TCP stack alone. **On loopback both endpoints are local**, so a real relay holding one end per member spends nearer half of it.

So the figure a ceiling should be derived from is the **total**, ~45 KB — not the process cost alone, or an owner's `ramLimitMB` quietly means something other than what they set.
`STREAMS_PER_MB = 16` implies 64 KB, so the guess is 34% pessimistic.

| disc | bytes per row |
|---|---|
| relay: a member | **197** |
| relay: a partner | **279** |
| node: a remembered peer, no route | **157** |
| node: one route for that peer | **420** |
| **node: a peer you can reach** | **577** |
| node: one logged exchange | **253** synthetic — a real one averages **438**, see below |
| an empty `relay.db` / `node.db` | 40 KB / 32 KB |

| the two boxes | |
|---|---|
| relay, 100 MB RAM | **~887 members connected at once** (37 MB headroom / 42 KB) |
| relay, 1 GB disc | **~5.5M member rows**, or ~3.8M partner rows |
| node, 1 MB RAM | **not possible** — bare Node.js is 42 MB |
| node, 10 MB disc | **~18,172 remembered peers** |
| node, 1 GB disc | **~2.5M logged exchanges** kept for ever — the cache cap (20 MB) is 2% of it |

