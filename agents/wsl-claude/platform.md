# linux-6.18 (wsl-claude)

**Measured 2026-10-24, against `7df82fff`.**

| | |
|---|---|
| platform | linux 6.18.33.2-microsoft-standard-WSL2 |
| node | v24.21.0 |
| harness | **95 red, 50 unhappy** — see `harness.txt` across 463 suites, 402s |
| per stream, process | **0 KB** |
| a reachable peer | **585 B** |
| bare node / relay at rest | 42 MB / 61 MB |

Both halves were taken in one run, so they describe the same tree.

- [`capacity.md`](capacity.md) — what this box holds, and how it was measured
- [`harness.txt`](harness.txt) — the whole harness output, kept because a red
  suite on a new platform is the most useful thing here

*The kernel-per-stream figure in `capacity.json` is not used and should not be:
see [the conventions](../README.md).*
