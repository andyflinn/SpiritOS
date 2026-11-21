# Info and Measurements on wsl

Measurements were taken on **Saturday, November 21, 2026** for repository commit **90a7785c1**

## The Machine the Measurements come from

- **OS/Platform**: Linux (linux)
- **OS Version**: 6.18.33.2-microsoft-standard-WSL2
- **Node.js Version**: v24.21.0
- **Total RAM**: 64,148 MB
- **CPU**: Intel(R) Xeon(R) Gold 6234 CPU @ 3.30GHz, 32 cores
- **Architecture**: x64

## Summary

- A SpiritOS relay given 512 Megabytes of RAM can hold live streams for 2,404 simultaneously.
- A SpiritOS node at rest uses 109 MB of RAM.
- A call to a node on its own machine answers in 2.8 ms, the slowest in 6.5 ms.
- A card request through a relay takes 153.4 ms, the slowest 183.2 ms; sealing and signing take 1.4 ms of it.
- The product tree, right now, has 71 outstanding issues in the test database.
- The leading module responsible for that count is spirit/app/testicle/element/search/testicle.js, with 43 of them.
- The leading test suite contributing to the error count is spirit/app/testicle/element/search/test/testicle.js, with 43 of them.

## Details

- [The test state](testState.md)
- [The general tests](generalTests.md)
- [The own suites](ownSuites.md)
