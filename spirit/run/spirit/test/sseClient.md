# spirit/sseClient.js — its own test

`connect(opts)`: reading Server-Sent Events, a parser and a reconnect loop. Owed since the rule *"every production script
has its own test"* (goal/G47.1, the cycle "the top 10 reds of Andy's testicle", 9). Its fetch, timers and randomness are
handed in; a timer is kept, not run, so each wait asked for is read.

- A stream of two events with heartbeats, then its end: fetched at its url with the headers its function gives; open said
  once; each event with its name and JSON data parsed; data lines of one event joined; a heartbeat no event; the end said
  as ended, a reconnect asked after the first wait (1 s).
- A refusal said with its status and its body's code and error; Retry-After waited; a 429 without it waits at least
  20 s; a fetch that throws said as unreachable and asked again.
- The wait doubles per failed attempt, capped at 8 s; spread by its randomness between half and all of it; bytes read
  set it back to the first.
- Silence past the idle wait aborts the stream, which is said and asked again. `close` stops it: a retry already due
  fetches nothing more.

## What its test must try to break

A heartbeat read as an event; multi-line data split; a refusal whose reason is lost; a backoff that never grows, or grows
past its cap; a half-open stream nobody notices; a closed client that reconnects.
