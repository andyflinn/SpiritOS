# event.js

`spirit/run/spirit/event/event.js` is the node's one dispatcher of events (goal/G40.6). Its test is `./event.js`.

Andy, goal/G43.3, the box: *"no leftover timers after a stream closes, and a receipt back in under 0.5 seconds."*

## Requirements

- A stream of `event.subscribe` holds one heartbeat and one listener on each source while it is open, and hears every event.
- When its client closes it, nothing is left: no heartbeat, no listener on the jobs, the relay events, the packets or the renames, and it is out of `pageStreams`.
- A server's stream (`X-Spirit-Reader: server`, the one every peerPost opens) ends the same way.
- Twenty opened and closed leave nothing.
- One stream closing leaves another open and hearing.

## What this suite does not judge

The receipt time. It depends on the network and the node a receipt crosses, and a suite must never reach a real node, so *"under 0.5 seconds"* is measured on a real node when this item is verified, from that node's traffic log (`kind` reply, `outcome` receipted, `ms`).
