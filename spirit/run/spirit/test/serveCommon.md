# spirit/serveCommon.js — its own test

What the node and the relay both answer HTTP with (cycle 0, NODE-AND-RELAY.md): reading a body, sending a file,
refusing too big or malformed, saying which build this is, and the first-run defaults. Owed since the rule *"every
production script has its own test"* (goal/G47.1, box v72). In process: a planted res, request stream, server and
socket, a scratch home for what it writes, and process.exit planted where it would stop the process.

- `portFromArgs`, `emailFromArgs`: `--port <n>`/`--port=<n>`, `--email <a>`/`--email=<a>` (goal/G30.2); null and `''`
  without the flag.
- `verifyStartupCwd`: refuses, exit 1 and a sentence naming the entry, from a folder that is not spirit/run or lacking
  a folder the entry names; a start from spirit/run with only `spirit/` goes on (goal/G16.9).
- `refuseListenError`: a port in use stops the process naming the port and the next one; any other error stops it too.
- `sendFile`: 200 with the type by extension; 404 for no file and for a path with a NUL, never a crash (goal/G41.30).
- `readBody` (goal/G16.6): a character split across chunks arrives whole; past `max` refused at once, 413
  `body-too-large`, the stream destroyed; a caller's own `code` and `message`; `onBytes` hears the running total.
- `readJsonBody`, `bodyBytes`, `useBody`: parsed, `{}` for empty, bad JSON rejects; one promise per request; a declared
  length past `BODY_MAX` refused before reading, and a chunked one by the running total, 413 and the socket destroyed;
  `bodyBytes` 0 before, the count after; what `useBody` sets is the body later readers get (goal/G41.15).
- `refuseTooBig`, `nodeRefusal`, `parseRequestPath`, `answerClientErrors`: 413 and true past `BODY_MAX`; "not now" with
  `node-not-now`, the status varying and the string never; 400 and null for `/%zz`, `/%` and `/%00` (goal/G41.30); an
  unparseable request answered 400 in order, a reset only destroyed.
- `clientKeyFor` (goal/G22.7): from the loopback the last X-Forwarded-For entry; elsewhere the socket address.
- `sendVersion`: version, commit, startedAt, relay.
- `firstDescription`, `ensureFirstRun` (goal/G30.7): to the second, UTC; written only into a blank; a relay named
  nothing or `relay` becomes `relay <hostname>`, a name of its own stays (rule/13).
- `writeEnvironment` (goal/G40.6): the port in spirit/state/environment.json, the folder made.
- `pageFile`, `PAGE_FILES` (goal/G43.18): the addresses served from their files under spirit/, the ghost favicon
  (Q26); every named file exists; anything else is itself.
- `debugFirst` is DEBUG.js's `answer` (goal/G41.19).

## What its test must try to break

A body joined chunk by chunk (U+FFFD in a signed request); a refused body that goes on being read; a rate-limit key
taken from the first, sender-written X-Forwarded-For entry; a NUL or bad escape that kills the process; a restart that
overwrites a description somebody typed.
