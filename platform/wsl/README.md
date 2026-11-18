# Info and Measurements on wsl

Measurements were taken on **Wednesday, November 18, 2026** for repository commit **f4ceb1e16**

## The Machine the Measurements come from

- **OS/Platform**: Linux (linux)
- **OS Version**: 6.18.33.2-microsoft-standard-WSL2
- **Node.js Version**: v24.21.0
- **Total RAM**: 64,148 MB
- **CPU**: Intel(R) Xeon(R) Gold 6234 CPU @ 3.30GHz, 32 cores
- **Architecture**: x64

## Summary

- A SpiritOS relay given 512 Megabytes of RAM can hold live streams for 2,403 simultaneously.
- A SpiritOS node at rest uses 105 MB of RAM.
- A call to a node on its own machine answers in 2.7 ms, the slowest in 7.8 ms.
- A card request through a relay takes 147.5 ms, the slowest 178.8 ms; sealing and signing take 1.4 ms of it.

## Details

- [The test state](testState.md)
- [The general tests](generalTests.md)
- [The own suites](ownSuites.md)
