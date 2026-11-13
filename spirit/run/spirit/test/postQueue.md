# spirit/postQueue.js — its own test

`createQueue(opts)`: which request goes next, and nothing else; a decision structure peerPost drives (Andy: *"the node
must not only queue, it also must have a hook for not-available responses, requeing with node-local timeout"*). Owed
since the rule *"every production script has its own test"* (goal/G47.1, box v72). Each test makes a queue on a planted
clock.

- The numbers: one in flight per relay (decision 0016), 4 MB held, background at a quarter, a timeout's backoff from
  2 s to at most 5 minutes.
- Order: `add` gives a growing sequence, never a clock; class outranks age (deliberate before background), age orders
  within a class; an unknown class is deliberate. `eligible` skips what cannot move: a backed-off pair, a relay whose
  slot is taken, an entry already sending; a lapsed backoff is eligible again.
- `started` counts an attempt and refuses a second start; `stopped` frees the slot; `done` drops entry, bytes, slot.
- Backoff: `silent` doubles per pair up to the cap; `busy` grows 250, 500, 1000, 2000 ms (goal/G4.30), never past the
  relay's quote, and never lengthens the wait a later timeout starts from; a backoff is per relay and target; `reached`
  clears it and both ladders start from the bottom. An unknown entry answers false.
- Patience: an untried entry, and one on the wire, never expire; a tried one past its patience is `expired` and may not
  retry; zero patience is one attempt.
- `nextWakeMs`: null when nothing waits on a clock (the busy loop that was), else the soonest backoff or patience.
- `accepts`: refuses at the door what would pass the bytes held, background past a quarter, and leaves the queue as it
  was.
- A restart: `restoreItem` keeps the order given, its `at`, `until`, attempts, and is never sending; `restorePair`
  brings a backoff back and `pairState` reads it. `now` is the queue's clock, monotonic by default.

## What its test must try to break

Age outranking class; a retry given a fresh sequence; a busy refusal recorded as target trouble (a popular peer backed
off as broken); a zero-patience entry expired before its first try; `nextWakeMs` answering a past moment and the
caller spinning; a shed from the middle instead of a refusal at the door.
