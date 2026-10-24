# linux-7.0 (claude-ubuntu)

**Measured 2026-10-24, against `cb790a62`.**

| | |
|---|---|
| platform | linux 7.0.0-38-generic |
| node | v22.23.3 |
| harness | **76 red, 43 unhappy** — see `harness.txt` across 459 suites, 201s |
| per stream, process | **0 KB** |
| a reachable peer | **585 B** |
| bare node / relay at rest | 42 MB / 62 MB |

Both halves were taken in one run, so they describe the same tree.

- [`capacity.md`](capacity.md) — what this box holds, and how it was measured
- [`harness.txt`](harness.txt) — the whole harness output, kept because a red
  suite on a new platform is the most useful thing here

*The kernel-per-stream figure in `capacity.json` is not used and should not be:
see [the conventions](../README.md).*
