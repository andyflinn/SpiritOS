# Info and Measurements on windows

Measurements were taken on **Wednesday, November 18, 2026** for repository commit **8418708d4**

## The Machine the Measurements come from

- **OS/Platform**: Windows_NT (win32)
- **OS Version**: 10.0.26200
- **Node.js Version**: v24.20.0
- **Total RAM**: 130,767 MB
- **CPU**: Intel(R) Xeon(R) Gold 6234 CPU @ 3.30GHz, 32 cores
- **Architecture**: x64

## Summary

- A SpiritOS relay given 512 Megabytes of RAM can hold live streams for 2,367 simultaneously.
- A SpiritOS node at rest uses 85 MB of RAM.
- A call to a node on its own machine answers in 15 ms, the slowest in 21.8 ms.
- A card request through a relay takes 82.3 ms, the slowest 335 ms; sealing and signing take 1.9 ms of it.

## Details

- [The test state](testState.md)
- [The general tests](generalTests.md)
- [The own suites](ownSuites.md)
