# windows-10.0

**Measured 2026-09-27, against `8c8347c`.**

| | |
|---|---|
| platform | win32 10.0.26200 |
| node | v24.20.0 |
| harness | **3 red, 2 unhappy** — see `harness.txt` across 169 suites, 107s |
| per stream, process | **57 KB** |
| a reachable peer | **579 B** |
| bare node / relay at rest | 51 MB / 62 MB |

Both halves were taken in one run, so they describe the same tree.

- [`capacity.md`](capacity.md) — what this box holds, and how it was measured
- [`harness.txt`](harness.txt) — the whole harness output, kept because a red
  suite on a new platform is the most useful thing here

*The kernel-per-stream figure in `capacity.json` is not used and should not be:
see [the conventions](../README.md).*
