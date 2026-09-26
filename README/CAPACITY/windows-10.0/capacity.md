# Capacity on `windows-10.0`

**Measured 2026-09-26, against `77e46e4`.**

| | |
|---|---|
| platform | win32 10.0.26200 |
| version | Windows 11 Pro |
| node | v24.20.0 |
| cpus / ram | 32 / 130767 MB |
| measured at | 2026-09-26T05:55:49.132Z |
| tree | `77e46e4` |

*Read [the conventions](../README.md) before comparing this with
another platform — the kernel column in particular is not the same
quantity on two operating systems.*

---


measured 2026-09-26, against `77e46e4`
on win32, Node v24.20.0

| minimum to run | |
|---|---|
| Node.js | **22.13 or later** (`node:sqlite`, which both stores need) |
| dependencies | **none** — built-ins only, no `npm install` |
| RAM, personal node | **83 MB** at rest |
| RAM, relay | **62 MB** at rest, before any connection |
| disc, the install | **4240 KB** in 129 files |

| fixed cost | RSS |
|---|---|
| bare `node`, nothing loaded | **50 MB** |
| a personal node at rest | **83 MB** |
| a relay at rest, 0 streams | **62 MB** |
| — of which SpiritOS | ~12 MB |

| streams | RSS | over baseline | per stream |
|---|---|---|---|
| 0 | 62 MB | — | — |
| 100 | 66 MB | 5 MB | 48 KB |
| 200 | 69 MB | 8 MB | 39 KB |
| 400 | 83 MB | 22 MB | 55 KB |
| 800 | 107 MB | 45 MB | 58 KB |

**~61 KB per held stream in the process**, from the slope of the last segment (the 100→200 segment reads 30 KB, which is the spread to expect).

**And ~10 KB more in the kernel**, which no RSS figure can see — non-paged pool, system-wide, so every driver on the box is in it. **On loopback both endpoints are local**, so a real relay holding one end per member spends nearer half of it.

So the figure a ceiling should be derived from is the **total**, ~71 KB — not the process cost alone, or an owner's `ramLimitMB` quietly means something other than what they set.
`STREAMS_PER_MB = 16` implies 64 KB, so the guess is 5% pessimistic.

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
| relay, 100 MB RAM | **~648 members connected at once** (38 MB headroom / 61 KB) |
| relay, 1 GB disc | **~1.8M member rows**, or ~0.3M partner rows |
| node, 1 MB RAM | **not possible** — bare Node.js is 50 MB |
| node, 10 MB disc | **~18,110 remembered peers** |
| node, 1 GB disc | **~2.5M logged exchanges** kept for ever — the cache cap (20 MB) is 2% of it |

