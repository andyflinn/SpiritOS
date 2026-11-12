# spirit/streamSink.js — its own test

`createStreamSink(res, opts)`, the sink a relay hands `relay.js` for one held stream, and the one place that notices a
reader that stopped reading (R35). Owed since the rule *"every production script has its own test"* (goal/G47.1, the
cycle "the top 10 reds of Andy's testicle", 8).

The held response is a hand that keeps what is done to it; its unread backlog (`writableLength`) is set by the test.

- No head until the first write; the first write writes it (200, `text/event-stream`, `no-cache`, `keep-alive`) and its
  chunk; a second write writes no second head. A reader that reads is not stalled. `close` ends the response.
- A write that leaves the backlog past the cap throws, the response is destroyed with no goodbye written, `stalled()`
  says so, `onStall` is not called inside the write but once on the next turn with the backlog, and a later write throws
  and writes nothing.
- With no cap given the cap is `limits.STREAM_BACKLOG_MAX`: at it nothing is cut, one byte past it is.

## What its test must try to break

A head written before the first write, or twice; a goodbye written to a reader that stopped; a cut on the cap itself
rather than past it; `onStall` called inside the delivery that tripped it, or more than once; a cut sink that writes on.
