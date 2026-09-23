# Capacity on `windows-10.0`

**Measured 2026-09-23, against `dbe5859`.**

| | |
|---|---|
| platform | win32 10.0.26200 |
| version | Windows 11 Pro |
| node | v24.20.0 |
| cpus / ram | 32 / 130767 MB |
| measured at | 2026-09-23T13:41:37.164Z |
| tree | `dbe5859` |

*Read [the conventions](../README.md) before comparing this with
another platform — the kernel column in particular is not the same
quantity on two operating systems.*

---


measured 2026-09-23, against `dbe5859`
on win32, Node v24.20.0

| minimum to run | |
|---|---|
| Node.js | **22.13 or later** (`node:sqlite`, which both stores need) |
| dependencies | **none** — built-ins only, no `npm install` |
| RAM, personal node | **89 MB** at rest |
| RAM, relay | **68 MB** at rest, before any connection |
| disc, the install | **4091 KB** in 123 files |

| fixed cost | RSS |
|---|---|
| bare `node`, nothing loaded | **56 MB** |
| a personal node at rest | **89 MB** |
| a relay at rest, 0 streams | **68 MB** |
| — of which SpiritOS | ~12 MB |

| streams | RSS | over baseline | per stream |
|---|---|---|---|
| 0 | 68 MB | — | — |
| 100 | 73 MB | 5 MB | 52 KB |
| 200 | 74 MB | 7 MB | 34 KB |
| 400 | 91 MB | 23 MB | 59 KB |
| 800 | 113 MB | 46 MB | 59 KB |

**~58 KB per held stream in the process**, from the slope of the last segment (the 100→200 segment reads 16 KB, which is the spread to expect).

**And ~10 KB more in the kernel**, which no RSS figure can see — non-paged pool, system-wide, so every driver on the box is in it. **On loopback both endpoints are local**, so a real relay holding one end per member spends nearer half of it.

So the figure a ceiling should be derived from is the **total**, ~67 KB — not the process cost alone, or an owner's `ramLimitMB` quietly means something other than what they set.
`STREAMS_PER_MB = 16` implies 64 KB, so the guess is 10% pessimistic.

| disc | bytes per row |
|---|---|
| relay: a member | **603** |
| relay: a partner | **3293** |
| node: a remembered peer, no route | **159** |
| node: one route for that peer | **420** |
| **node: a peer you can reach** | **579** |
| node: one logged exchange | **253** synthetic — a real one averages **438**, see below |
| an empty `relay.db` / `node.db` | 40 KB / 56 KB |

| the two boxes | |
|---|---|
| relay, 100 MB RAM | **~575 members connected at once** (32 MB headroom / 58 KB) |
| relay, 1 GB disc | **~1.8M member rows**, or ~0.3M partner rows |
| node, 1 MB RAM | **not possible** — bare Node.js is 56 MB |
| node, 10 MB disc | **~18,110 remembered peers** |
| node, 1 GB disc | **~2.5M logged exchanges** kept for ever — the cache cap (20 MB) is 2% of it |

