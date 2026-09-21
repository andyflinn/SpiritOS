# Capacity on `windows-10.0`

**Measured 2026-09-21, against `c995478`.**

| | |
|---|---|
| platform | win32 10.0.26200 |
| version | Windows 11 Pro |
| node | v24.20.0 |
| cpus / ram | 32 / 130767 MB |
| measured at | 2026-09-21T15:07:35.116Z |
| tree | `c995478` |

*Read [the conventions](../README.md) before comparing this with
another platform — the kernel column in particular is not the same
quantity on two operating systems.*

---


measured 2026-09-21, against `c995478`
on win32, Node v24.20.0

| minimum to run | |
|---|---|
| Node.js | **22.13 or later** (`node:sqlite`, which both stores need) |
| dependencies | **none** — built-ins only, no `npm install` |
| RAM, personal node | **73 MB** at rest |
| RAM, relay | **59 MB** at rest, before any connection |
| disc, the install | **3773 KB** in 110 files |

| fixed cost | RSS |
|---|---|
| bare `node`, nothing loaded | **49 MB** |
| a personal node at rest | **73 MB** |
| a relay at rest, 0 streams | **59 MB** |
| — of which SpiritOS | ~10 MB |

| streams | RSS | over baseline | per stream |
|---|---|---|---|
| 0 | 59 MB | — | — |
| 100 | 64 MB | 5 MB | 55 KB |
| 200 | 68 MB | 9 MB | 44 KB |
| 400 | 83 MB | 24 MB | 61 KB |
| 800 | 106 MB | 47 MB | 60 KB |

**~60 KB per held stream in the process**, from the slope of the last segment (the 100→200 segment reads 33 KB, which is the spread to expect).

**And ~21 KB more in the kernel**, which no RSS figure can see — non-paged pool, system-wide, so every driver on the box is in it. **On loopback both endpoints are local**, so a real relay holding one end per member spends nearer half of it.

So the figure a ceiling should be derived from is the **total**, ~81 KB — not the process cost alone, or an owner's `ramLimitMB` quietly means something other than what they set.
`STREAMS_PER_MB = 16` implies 64 KB, so the guess is 6% pessimistic.

| disc | bytes per row |
|---|---|
| relay: a member | **197** |
| relay: a partner | **279** |
| node: a remembered peer | **157** |
| node: one logged exchange | **253** synthetic — a real one averages **438**, see below |
| an empty `relay.db` / `node.db` | 40 KB / 32 KB |

| the two boxes | |
|---|---|
| relay, 100 MB RAM | **~699 members connected at once** (41 MB headroom / 60 KB) |
| relay, 1 GB disc | **~5.5M member rows**, or ~3.8M partner rows |
| node, 1 MB RAM | **not possible** — bare Node.js is 49 MB |
| node, 10 MB disc | **~66,788 remembered peers** |
| node, 1 GB disc | **~2.5M logged exchanges** kept for ever — the cache cap (20 MB) is 2% of it |

