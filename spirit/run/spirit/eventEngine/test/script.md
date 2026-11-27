# event.js

`spirit/run/spirit/eventEngine/script.js` is the node's one dispatcher of events (goal/G40.6). Its test is `./script.js`.

Andy, goal/G43.3, the box: *"no leftover timers after a stream closes, and a receipt back in under 0.5 seconds."*

## Requirements

- A stream of `event.subscribe` holds one heartbeat and one listener on each source while it is open, and hears every event.
- When its client closes it, nothing is left: no heartbeat, no listener on the jobs, the relay events, the packets or the renames, and it is out of `pageStreams`.
- A server's stream (`X-Spirit-Reader: server`, the one every peerPost opens) ends the same way.
- Twenty opened and closed leave nothing.
- One stream closing leaves another open and hearing.

## What this suite does not judge

The receipt time. It depends on the network and the node a receipt crosses, and a suite must never reach a real node, so *"under 0.5 seconds"* is measured on a real node when this item is verified, from that node's traffic log (`kind` reply, `outcome` receipted, `ms`).

- A quiet stream hears a beat each second (box v148): in 4 s with nothing to send, no gap between its writes is longer than 1.5 s.

## A page's connect reaches every app server (goal/G47.5, part 2)

Andy: *"the node forwards a loopback connect to the as server as a normal request, so that spirit/server/app/script.js knows a
loopback client connected"*, *"the connect to all app servers doesn't need a loopback mark, it will reach the app server
with the local node's ID"*, *"47.5 WILL NOT HAVE ANY APP-SPECIFIC SHIT IN IT."* On a scratch node of lab's, a planted app
server whose bootstrap writes down every subscriber that is its own node: a page opens the node's event stream, and that
subscriber is written down. (With the subscribe made by hand under the node's key instead, the check passes: the node, the
server and the writing down work.)
