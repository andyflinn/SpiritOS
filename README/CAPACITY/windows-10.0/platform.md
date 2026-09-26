# windows-10.0

**Measured 2026-09-26, against `77e46e4`.**

| | |
|---|---|
| platform | win32 10.0.26200 |
| node | v24.20.0 |
| harness | **2 red, 1 unhappy** — see `harness.txt` across 157 suites, 104s |
| per stream, process | **61 KB** |
| a reachable peer | **579 B** |
| bare node / relay at rest | 50 MB / 62 MB |

Both halves were taken in one run, so they describe the same tree.

- [`capacity.md`](capacity.md) — what this box holds, and how it was measured
- [`harness.txt`](harness.txt) — the whole harness output, kept because a red
  suite on a new platform is the most useful thing here

*The kernel-per-stream figure in `capacity.json` is not used and should not be:
see [the conventions](../README.md).*
