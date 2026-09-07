# Cycle A2 — speakable invite token

Patch current master. Do not replace `spirit/run/js/relay.js` as a whole file.

## Point

Andy types a short token in Relay Chat. That string is what he speaks on the phone. It must be **inside** `mintMessage` so a status-sig or a mint-sig for a different token cannot be replayed.

## Patch

- `spirit/run/js/invites.js` — `mintMessage(label, days, token)`. When token is empty, message stays `invite\nlabel\ndays` (today). When token is set, `invite\nlabel\ndays\ntoken`. `add()` already accepts `opts.token`.
- `spirit/run/js/relay.js` `mint()` — pass the optional token through to `mintMessage` and `add`. Validate token with the same name rules as a label (`A-Za-z0-9._-`, 1–32) or refuse 400. Still generate a hex token when the field is empty.
- `spirit/run/js/hub.js` — forward `body.token`.
- `spirit/run/app/relayChat/relayChat.js` — send the typed token; on 201 show that token (not “your token was not used”).

## Out of scope

- Cycle B whoBook / title bar
- Kamatera cutover
- Replacing mintMessage for old tests that sign two-arg form — keep two-arg meaning “relay picks the token”

## Test

```
node spirit/test/inviteSpeakable.js
node spirit/test/inviteMint.js
node spirit/test/cycleA.js
```
