# Device cycle 4 — device-take header + minute

No shell look. No `/device` copy change except the tick.

## Drop map

| File from Grok | Repo path |
| -------------- | --------- |
| `DEVICE-CYCLE4.md` | `DEVICE-CYCLE4.md` (root) |
| `deviceSig.js` | `spirit/test/deviceSig.js` |

Do not drop `deviceAuth.js`, `deviceTick.js`, `relay.js`, `server.js`, `hub.js`. Patch those.

## Why

`GET /api/relay/device-pending?name=&sig=` puts a non-expiring house signature in Caddy’s access log. That signature unlocks the RAM slot `{ password, devicePublicKey }`. Inbox already refuses a query `sig` (`inboxSignatureFrom`).

## deviceAuth.js — patch

`deviceTakeMessage(name, atMs)` becomes:

```
'device-take\n' + name + '\n' + minute
```

Same minute math as `inboxMessage`. Add `deviceTakeSignatureOk(publicKey, name, sig, atMs)` — current minute ± 1, copy of `inboxSignatureOk`.

A signature over the old two-line message must fail.

## relay.js — patch

`deviceGate` verifies with `deviceTakeSignatureOk` against the **house** key only.

`devicePending` / `deviceAnswer` still take `(name, sig)` after the server has pulled the header. They do not read the query string.

Reuse `inboxSignatureFrom` on the GET. Query `sig` → 403 `not now` (or the existing inbox error; if you change the string, keep device routes on `not now` only — prefer wrapping so device still says `not now`).

## server.js — patch

`GET /api/relay/device-pending`:

- `inboxSignatureFrom(url.searchParams.get('sig'), req.headers)`
- On refuse: 403 `{ "error": "not now" }`
- Else `relay.devicePending(name, from.sig)`

No `sig=` on the URL we document. POST `/api/relay/set-device` and `/api/relay/device-answer` already carry `sig` in JSON — leave them.

## deviceTick.js — patch

`requestFn(url, method, path, body, headers)`.

Take path is `/api/relay/device-pending?name=` only. Header `X-Spirit-Sig` is the live `deviceTakeMessage` signature.

`deviceListen.js` fake `requestFn` must accept the fifth argument. If a test still puts `sig=` in the path, fix the test.

## hub.js — patch

The HTTP helper used by the 2s timer must send `X-Spirit-Sig` on the pending GET. Do not put `sig` in the query.

## Out

- Console on `/device`
- Natter copy
- Packet kinds
- Minute window on set-device POST (body sig is not in the access-log URL)

## Test

```
node spirit/test/deviceSig.js
node spirit/test/deviceListen.js
node spirit/test/deviceHandshakeTest.js
```

On unpatched master, `# take message has a minute` fails first.
