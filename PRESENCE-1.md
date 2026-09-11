# Presence 1 — the relay speaks presence

Stage 1 of [design/relay/PRESENCE.md](design/relay/PRESENCE.md). Relay side
only. Nothing in this packet touches a personal node, the shell, or any app.

Written here rather than by Grok — the review budget now goes to periodic
detailed review rather than per-cycle packets.

## What it is

`GET /api/relay/stream` — an SSE connection a personal node holds open. The
relay pushes **who among its members is reachable right now**. Nothing else
ever travels on it.

The set of open connections *is* the presence. There is no announce message,
no heartbeat protocol, no last-seen timestamp, and no timeout to tune: a
socket dying is an absence.

## New file: `spirit/run/js/presence.js`

The connection registry, the way `deviceHandshake.js` is the slot registry —
same reason, to keep `relay.js` from growing a second subsystem inside
itself. In RAM only, never written to disk.

```
createRegistry({ perMin, now })
  connect(id, sink)   -> { ok } | { ok:false, status:429 }
  disconnect(id, sink)
  present()           -> [id, ...]
  broadcast(event, data)
  reset()
```

- `connect` records a hit against a **per-identity** bucket, `perMin`
  defaulting to **6**, refusing with **429** past it.
- A second `connect` for an id already present **closes the first**, then
  installs the new one. Newest wins; the relay keeps no opinion about why a
  node reconnected.
- `sink` is whatever can be written to and closed — the response object in
  production, a fake in tests. **No `http` in this file.**
- `disconnect` is idempotent and must tolerate being called twice, because
  both `close` and `error` will call it.

## `relayAuth.js` — one message, and it is its own

```js
function streamMessage(key, atMs)   // 'stream\n<key>\n<unix-minute>'
function streamSignatureOk(publicKey, key, sig, atMs)   // ±1 minute
```

Its own verb, for the reason `deviceGate` already records: the owner signs
`status` for every census, and a captured signature must not be replayable
as something else. A stream is a better prize than a single read because
what it grants **stands**.

## `relay.js` — the gate, and the roster

```js
function streamOpen(token, sig, sink)
function streamRoster()
```

`streamOpen`:

1. `deviceIdentity(token)` — B2's resolver, unchanged. **Unknown identity is
   refused here, before any bucket is touched and before any crypto**, the
   rule B1 established: `queueFor` mints on first use, so reaching a
   registry with an id a stranger chose lets them grow it.
2. The per-identity connect bucket. 429 past six.
3. `streamSignatureOk` against **that identity's own row key** — never the
   owner's house key, and never a device key.
4. Only then `registry.connect(who.id, sink)`. **Authenticate, then toss** —
   if an unauthenticated connect could displace a live one, anybody could
   knock any peer offline by connecting badly in their name.
5. Send the roster (below), then register for changes.

`streamRoster()` is **the roster with each member's state**, not the list of
the connected:

```json
{ "members": [ { "key": "MCow…", "label": "bert", "present": true },
               { "key": "MCow…", "label": "john", "present": false } ] }
```

Both halves already exist — `who()` is the roster, `registry.present()` is
the subset. It has to be both or a node cannot tell 🔴 *away* from ⚪ *never
heard of*, which is the distinction the whole colour scheme rests on.

On any change, broadcast **only what changed**:

```
event: presence
data: {"key":"MCow…","present":true}
```

## `server.js` — the route

- `isRelayPublicPath`: `GET /api/relay/stream`, relay mode only. Public in
  the same sense the rest is — reachable from the internet, gated inside
  `relay.js`.
- The signature is a **header**, and a query-string `sig` is refused even
  when the header is good. Reuse `createRelay.inboxSignatureFrom`, which is
  the function that already enforces it.
- Headers, heartbeat and teardown copied from `handleSseConnection` — it is
  the same protocol and that handler has already paid for its lessons:

  ```
  Content-Type: text/event-stream
  Cache-Control: no-cache
  Connection: keep-alive
  ```

  A `:\n\n` comment every 20 seconds, and **teardown bound to `close` AND
  `error`** with a once-guard. The comment there says why, and it is the
  bug that matters most here: a socket that dies without a clean close
  leaves a peer reading as present forever, which is the relay lying.

## Tests — `spirit/test/presenceStream.js`

Drive `createRelay` in process with fake sinks. No sockets.

1. Two members connect; each appears `present` in the other's roster.
2. A roster names **absent members too** — remove that and ⚪ becomes
   indistinguishable from 🔴.
3. Disconnecting one broadcasts a change to the other, carrying only the
   key that moved.
4. A second connect for the same key **closes the first sink** and the new
   one receives the roster.
5. A `stream` signature is refused where an `inbox` or `status` signature is
   offered instead — the replay this verb exists to prevent.
6. A signature a minute stale passes; two minutes fails.
7. A key with no row is refused **without the registry growing** — assert on
   the registry, not on the status code, or a comment could satisfy it.
8. The seventh connect inside a minute is 429, and another identity's first
   is not.
9. A query-string `sig` is refused even with a good header.

## Out

Everything. No node-side client, no permanent job, no shell API, no Contacts
column, no messages, no device offers on this wire, and no connection-scale
measurement — see PRESENCE.md §8 for why that last one waits.

## Running it

`git add` `presence.js` and `presenceStream.js` **before** the harness —
`setupRelayFakes` copies from `git ls-files`.

Green, then stop.
