# Info and Measurements on ubuntu

Measurements were taken on **Saturday, November 21, 2026** for repository commit **f1fd9378a**

## The Machine the Measurements come from

- **OS/Platform**: Linux (linux)
- **OS Version**: 7.0.0-42-generic
- **Node.js Version**: v22.23.3
- **Total RAM**: 7,274 MB
- **CPU**: Intel(R) Core(TM) i5-8500 CPU @ 3.00GHz, 6 cores
- **Architecture**: x64

## Summary

- A SpiritOS relay given 512 Megabytes of RAM can hold live streams for 2,398 simultaneously.
- A SpiritOS node at rest uses 74 MB of RAM.
- A call to a node on its own machine answers in 0.8 ms, the slowest in 2.6 ms.
- A card request through a relay takes 70.6 ms, the slowest 277.2 ms; sealing and signing take 0.6 ms of it.
- The product tree, right now, has 109 outstanding issues in the test database.
- The leading module responsible for that count is spirit/app/testicle/element.js, with 79 of them.
- The leading test suite contributing to the error count is spirit/app/testicle/test/element.js, with 79 of them.

## Details

- [The test state](testState.md)
- [The general tests](generalTests.md)
- [The own suites](ownSuites.md)
