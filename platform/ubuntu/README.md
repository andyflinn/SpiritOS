# Info and Measurements on ubuntu

Measurements were taken on **Saturday, November 21, 2026** for repository commit **90a7785c1**

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
- A call to a node on its own machine answers in 0.8 ms, the slowest in 2.5 ms.
- A card request through a relay takes 70.7 ms, the slowest 87.1 ms; sealing and signing take 0.6 ms of it.
- The product tree, right now, has 175 outstanding issues in the test database.
- The leading module responsible for that count is spirit/app/testicle/element.js, with 79 of them.
- The leading test suite contributing to the error count is spirit/test/spirit-sibling-general.js, with 81 of them.

## Details

- [The test state](testState.md)
- [The general tests](generalTests.md)
- [The own suites](ownSuites.md)
