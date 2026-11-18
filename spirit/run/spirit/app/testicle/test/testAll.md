# spirit/app/testicle/test/testAll.js

The test of `spirit/app/testicle/testAll.js` (goal/G47.6, box point 5: *"npm test points at a product test-all: one command
that runs every suite through testicle's queue on a fresh checkout and fails when anything is red."*; cw: *"testAll.js, in
testicle's own folder ... npm test runs it."*).

- `npm test` runs `spirit/run/spirit/app/testicle/testAll.js`.
- The file is there.
- Judged in minutes, not on the whole tree: on a scratch tree with no node running on it, one planted script whose own
  suite holds and one whose own suite fails. testAll given both exits other than 0; given the holding one alone, it exits 0.

Given scripts it runs only their own suites; given none, every suite of the tree (cw and wsl, 2026-11-18: the red judges the
exit code, not the general rules a planted two-line file would fail). It runs them with testicle's own selection and
runner, started by testAll itself; no live node is needed. How is the builder's.
