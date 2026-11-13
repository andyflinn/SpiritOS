# spirit/presenceNode.js — its own test

`createPresence(opts)` and `streamUrl(relayUrl, key)`: the personal node's half of presence, one held stream to every
relay it holds a seat on, merged into one table and published as news of `spirit.contact`. Owed since the rule
*"every production script has its own test"* (goal/G47.1, box v72). In process, on a scratch folder with an identity
and two seated relays; the stream, router, jobs and every hook are planted, and a stream is driven through the
`onOpen`, `onEvent` and `onClose` its connect was handed.

- Construction: refused without the router it posts from (half an interface). `streamUrl`: the stream door, the key
  in the query, a trailing slash dropped.
- `start`: one stream per seated relay, under this node's key; owns the `spirit.contact` job (goal/G43.20); with
  nothing to ask, opens nothing. Each attempt signs afresh, in a header, for that relay's pinned key alone. The relay is
  pinned as its stream opens.
- On open: the relay and this node are present, each a proof `{present, at}` (goal/G2.9); the card is handed over,
  sealed to the relay's key (cycle 10, R20); the book is reconciled once by the relay's own search `*` (goal/G2.8), a
  named contact green, a named stranger learned not drawn, a refusing relay marking nobody; the open edge recorded;
  the table published as `{ presence }` and nothing else.
- Broadcasts: the relay broadcasts, the node filters (Andy, 2026-09-19). A contact present is green; a stranger is
  noted as seen (R27) and not drawn; the same word twice is no news; across relays present wins; absent everywhere is
  red; `gone` is not absent, the key leaves and is white.
- `heard`: green for a relay with a stream, false for one without, a stranger not drawn. `relaysNaming` the relays
  saying present.
- The stream's other events: request and reply to the router; route, face, face-open, face-close to their hooks;
  relay-status kept as the latest, recorded, nudged carrying the report (goal/G41.32), paced to one a second;
  relay-event and owner-event stamped with their relay. `handOverCardEverywhere` to every open stream, counted.
- A closed stream stops asserting, its edge recorded; `stop` closes every stream and empties the table. With no
  `knows` every key is kept.

## What its test must try to break

A relay's absent word beating another's present; `gone` kept as red for ever; a stranger's broadcast dropped before it
is learned (R27); a closed relay still asserting its last picture; a quiet relay repainting the shell; a stream
signature good for any relay; a report burst repainting the monitor on every report.

Not tried: the first meeting (goal/G16.12), where the connect waits for the pin, since a relay can only be seated
with its key already on record, so `start` never reaches an unpinned url.
