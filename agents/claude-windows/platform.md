# windows-10.0 (claude-windows)

**Measured 2026-10-04, against `3ce4152f`.**

| | |
|---|---|
| platform | win32 10.0.26200 |
| node | v24.20.0 |
| harness | **19 red, 9 unhappy** — see `harness.txt` across 306 suites, 424s |
| per stream, process | **60 KB** |
| a reachable peer | **579 B** |
| bare node / relay at rest | 59 MB / 70 MB |

Both halves were taken in one run, so they describe the same tree.

- [`capacity.md`](capacity.md) — what this box holds, and how it was measured
- [`harness.txt`](harness.txt) — the whole harness output, kept because a red
  suite on a new platform is the most useful thing here

*The kernel-per-stream figure in `capacity.json` is not used and should not be:
see [the conventions](../README.md).*
