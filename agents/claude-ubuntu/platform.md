# linux-7.0 (claude-ubuntu)

**Measured 2026-10-04, against `3ce4152f`.**

| | |
|---|---|
| platform | linux 7.0.0-15-generic |
| node | v22.23.3 |
| harness | **8 red, 6 unhappy** — see `harness.txt` across 306 suites, 164s |
| per stream, process | **30 KB** |
| a reachable peer | **579 B** |
| bare node / relay at rest | 42 MB / 63 MB |

Both halves were taken in one run, so they describe the same tree.

- [`capacity.md`](capacity.md) — what this box holds, and how it was measured
- [`harness.txt`](harness.txt) — the whole harness output, kept because a red
  suite on a new platform is the most useful thing here

*The kernel-per-stream figure in `capacity.json` is not used and should not be:
see [the conventions](../README.md).*
