# spirit/appServer.js

The app server of a node's process (goal/G19.1): it serves a server's verbs on its pipe, publishes its stream to its
pages and subscribers (streamPublisher), and follows another server's stream into its own data set (streamListener,
the client half). This spec covers only what goal/G41.11 asks of the client half; the rest of the module has no
requirement written here yet.

## Requirements (goal/G41.11)

- **A subscribe keeps the cache** (Andy, 2026-10-27: "deskClient keeps it's cache (all clients using spirit-client
  services, that's where the fix belongs) through new subscribes."). `s.subscribe(key, family)` follows the key and asks
  the publisher's family to subscribe this server, and leaves every row kept in its data set (`appServer.data`, the
  server's spirit.data) in place: on the first subscribe and on every one after. What the publisher's bootstrap then
  pushes updates the rows it names and nothing else.
- Before goal/G41.11 a subscribe was a connect that forgot the whole cache (goal/G41.3, Q2), and every client's cache
  stood empty until the bootstrap arrived; a client that subscribed again after a quiet stream emptied its cache each
  time and refilled it from the desk, flooding it.

## What its test must try to break

- A kept row gone after the first subscribe, or after a second.
- A subscribe that no longer asks the publisher, or no longer follows the key.
