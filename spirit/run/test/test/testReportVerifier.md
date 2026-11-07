# A test's results reach the verifier

goal/G43.23, item 3. Its test is `./testReportVerifier.js`: a scratch run tree under /tmp with a copy of `../testReport.js` and `spirit/`, whose `spirit/state/environment.json` names a fake verifier this suite stands up; a probe test there is run with `--verify-port <that port>`. No live node is touched.

The box: *"no test result reaches the verifier: testReport.js requires the gone spirit/run/spirit.js and swallows the error."*

## Requirements

- A test run with `--verify-port <port>` hands its results to the verifier listening there: the verifier is handed records at all.
- A green reaches the verifier as one record with outcome green.
- A red reaches the verifier as one record with outcome red, carrying the failure it printed.
