# windows-10.0

**Measured 2026-09-21, against `f06d7e9`.**

| | |
|---|---|
| platform | win32 10.0.26200 |
| node | v24.20.0 |
| harness | **2665 green, 0 red** across 112 suites, 54s |
| per stream, process | **57 KB** |
| a reachable peer | **577 B** |
| bare node / relay at rest | 49 MB / 59 MB |

Both halves were taken in one run, so they describe the same tree.

- [`capacity.md`](capacity.md) — what this box holds, and how it was measured
- [`harness.txt`](harness.txt) — the whole harness output, kept because a red
  suite on a new platform is the most useful thing here

*The kernel-per-stream figure in `capacity.json` is not used and should not be:
see [the conventions](../README.md).*
