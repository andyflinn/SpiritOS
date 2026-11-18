# Info and Measurements on ubuntu

Measurements were taken on **Wednesday, November 18, 2026** for repository commit **f4ceb1e1**

## The Machine the Measurements come from

- **OS/Platform**: Linux (linux)
- **OS Version**: 7.0.0-42-generic
- **Node.js Version**: v22.23.3
- **Total RAM**: 7,274 MB
- **CPU**: Intel(R) Core(TM) i5-8500 CPU @ 3.00GHz, 6 cores
- **Architecture**: x64

## Summary

- A SpiritOS relay given 512 Megabytes of RAM can hold live streams for 2,397 simultaneously.
- A SpiritOS node at rest uses 73 MB of RAM.
- A call to a node on its own machine answers in 1 ms, the slowest in 3 ms.
- A card request through a relay takes 74.1 ms, the slowest 274.8 ms; sealing and signing take 0.6 ms of it.

## Details

- [The test state](testState.md)
- [The general tests](generalTests.md)
- [The own suites](ownSuites.md)
