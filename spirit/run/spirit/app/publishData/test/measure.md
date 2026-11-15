# measure.js

The figures of a platform README's Summary (goal/G47.1, box v170, "#### publishData"), measured on lab nodes and a lab
relay only, never the node publishData was started by, never a live relay. Spec of `spirit/app/publishData/measure.js`;
its test is `./measure.js`.

## rssOf(pid)

- A running process's resident memory, in bytes, as the operating system holds it: `/proc/<pid>/status` on Linux, the
  process list on Windows, its digits grouped as the locale groups them.
- 0 for a process that is not there.

## measure(say)

- Takes two lab nodes and one lab relay from `repo://lab/labNodes.js`, and frees all three when it is done, whether it
  succeeds or throws.
- Answers `{ nodeAtRestMB, relayAtRestRss, loop: { median, max }, relayed: { median, max, crypto } }`:
  - `nodeAtRestMB`: a lab node's memory 30 s after its start, in MB.
  - `relayAtRestRss`: the lab relay's memory soon after its start, in bytes; the members figure takes it, by the relay's
    own rule.
  - `loop`: 100 plain card asks at that node's door on 127.0.0.1, nothing sealed, nothing relayed, in ms.
  - `relayed`: 100 card asks from one lab node to the other through the lab relay, both seated on it (the first owns
    it, the second claims with an invite the first minted), in ms; `crypto` the sealing and signing of both hops, timed
    apart 1000 times on packets of the same size, in ms per request.
- Medians and the worst only: no list of the iterations leaves it (the box: "no raw numbers").
- `say`, when given, hears each step.

## What would be a fault

- A memory figure of 0 for a running process, or one for a process that is gone.
- A median above its worst, a crypto share of 0 or above the request it is a share of.
- A lab node or relay still held after it answered.
- A figure taken from the node that started publishData, or from a live relay.
