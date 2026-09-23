# windows-10.0

**Measured 2026-09-23, against `6d7dfa7`.**

| | |
|---|---|
| platform | win32 10.0.26200 |
| node | v24.20.0 |
| harness | **1 red, 1 unhappy** — see `harness.txt` across 145 suites, 74s |
| per stream, process | **61 KB** |
| a reachable peer | **579 B** |
| bare node / relay at rest | 56 MB / 68 MB |

Both halves were taken in one run, so they describe the same tree.

- [`capacity.md`](capacity.md) — what this box holds, and how it was measured
- [`harness.txt`](harness.txt) — the whole harness output, kept because a red
  suite on a new platform is the most useful thing here

*The kernel-per-stream figure in `capacity.json` is not used and should not be:
see [the conventions](../README.md).*
