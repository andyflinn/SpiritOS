# ubuntu-24.04-wsl2

**Measured 2026-09-26, against `a95b0d1`.**

| | |
|---|---|
| platform | linux 6.18.33.2-microsoft-standard-WSL2 |
| node | v24.21.0 |
| harness | **2 red, 1 unhappy** — see `harness.txt` across 155 suites, 85s |
| per stream, process | **23 KB** |
| a reachable peer | **579 B** |
| bare node / relay at rest | 42 MB / 64 MB |

Both halves were taken in one run, so they describe the same tree.

- [`capacity.md`](capacity.md) — what this box holds, and how it was measured
- [`harness.txt`](harness.txt) — the whole harness output, kept because a red
  suite on a new platform is the most useful thing here

*The kernel-per-stream figure in `capacity.json` is not used and should not be:
see [the conventions](../README.md).*
