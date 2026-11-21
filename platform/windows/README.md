# Info and Measurements on windows

Measurements were taken on **Saturday, November 21, 2026** for repository commit **90a7785c1**

## The Machine the Measurements come from

- **OS/Platform**: Windows_NT (win32)
- **OS Version**: 10.0.26200
- **Node.js Version**: v24.20.0
- **Total RAM**: 130,767 MB
- **CPU**: Intel(R) Xeon(R) Gold 6234 CPU @ 3.30GHz, 32 cores
- **Architecture**: x64

## Summary

- A SpiritOS relay given 512 Megabytes of RAM can hold live streams for 2,356 simultaneously.
- A SpiritOS node at rest uses 86 MB of RAM.
- A call to a node on its own machine answers in 14.5 ms, the slowest in 21.3 ms.
- A card request through a relay takes 83.5 ms, the slowest 275.8 ms; sealing and signing take 1.8 ms of it.
- The product tree, right now, has 31 outstanding issues in the test database.
- The leading module responsible for that count is spirit/app/testicle/element.js, with 8 of them.
- The leading test suite contributing to the error count is spirit/app/testicle/test/element.js, with 8 of them.

## Details

- [The test state](testState.md)
- [The general tests](generalTests.md)
- [The own suites](ownSuites.md)
