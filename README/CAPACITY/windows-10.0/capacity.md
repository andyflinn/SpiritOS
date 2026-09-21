# Capacity on `windows-10.0`

**Measured 2026-09-21, against `f06d7e9`.**

| | |
|---|---|
| platform | win32 10.0.26200 |
| version | Windows 11 Pro |
| node | v24.20.0 |
| cpus / ram | 32 / 130767 MB |
| measured at | 2026-09-21T16:02:32.174Z |
| tree | `f06d7e9` |

*Read [the conventions](../README.md) before comparing this with
another platform — the kernel column in particular is not the same
quantity on two operating systems.*

---


measured 2026-09-21, against `f06d7e9`
on win32, Node v24.20.0

| minimum to run | |
|---|---|
| Node.js | **22.13 or later** (`node:sqlite`, which both stores need) |
| dependencies | **none** — built-ins only, no `npm install` |
| RAM, personal node | **73 MB** at rest |
| RAM, relay | **59 MB** at rest, before any connection |
| disc, the install | **3774 KB** in 110 files |

| fixed cost | RSS |
|---|---|
| bare `node`, nothing loaded | **49 MB** |
| a personal node at rest | **73 MB** |
| a relay at rest, 0 streams | **59 MB** |
| — of which SpiritOS | ~10 MB |

| streams | RSS | over baseline | per stream |
|---|---|---|---|
| 0 | 59 MB | — | — |
| 100 | 64 MB | 5 MB | 52 KB |
| 200 | 66 MB | 7 MB | 36 KB |
| 400 | 82 MB | 23 MB | 59 KB |
| 800 | 104 MB | 45 MB | 58 KB |

**~57 KB per held stream in the process**, from the slope of the last segment (the 100→200 segment reads 20 KB, which is the spread to expect).

**And ~36 KB more in the kernel**, which no RSS figure can see — non-paged pool, system-wide, so every driver on the box is in it. **On loopback both endpoints are local**, so a real relay holding one end per member spends nearer half of it.

So the figure a ceiling should be derived from is the **total**, ~93 KB — not the process cost alone, or an owner's `ramLimitMB` quietly means something other than what they set.
`STREAMS_PER_MB = 16` implies 64 KB, so the guess is 11% pessimistic.

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
| relay, 100 MB RAM | **~737 members connected at once** (41 MB headroom / 57 KB) |
| relay, 1 GB disc | **~5.5M member rows**, or ~3.8M partner rows |
| node, 1 MB RAM | **not possible** — bare Node.js is 49 MB |
| node, 10 MB disc | **~18,172 remembered peers** |
| node, 1 GB disc | **~2.5M logged exchanges** kept for ever — the cache cap (20 MB) is 2% of it |

