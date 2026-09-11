# Device B1 — slot and rate per identity

First commit of B. Same sitting as the `device-pending` bucket.

## Drop map

| File from Grok | Repo path |
| --- | --- |
| `DEVICE-B.md` | `DEVICE-B.md` (root) |
| `DEVICE-B1.md` | `DEVICE-B1.md` (root) |
| `deviceHandshake.js` | `spirit/run/js/deviceHandshake.js` (replace) |
| `deviceSlots.js` | `spirit/test/deviceSlots.js` |

Do not drop `relay.js`. Patch the call sites.

## Shape

`createQueue()` is still called **once** in `createRelay`.

Inside, one inner queue per normalized name:

- `offer(name, password, devicePublicKey)`
- `take(name)` — returns that name's `{ password, devicePublicKey }` or `null`. Never another name's password.
- `reply(name, accepted)`
- `pendingRateOk(name)` — records a hit; false after `perMin` in 60s
- `reset(name)` or `reset()` for all

Empty name → `not now`. Do not invent a global fallback slot.

## relay.js — patch

`deviceOffer` / `deviceTake` / `deviceReply` take a **name**.

- `POST /api/relay/device` body may include `name`. If missing, use the owner label so today's `device.html` still enrols Andy. Do not change the page look.
- `devicePending(name, sig)`: **first** `pendingRateOk(name)`; if false → 429 `not now`. Then the existing house-key gate (B2 changes the gate). Then `take(name)`.
- Wrong / unknown name still fails before crypto, as today.

## Tests

```
node spirit/test/deviceSlots.js
node spirit/test/deviceHandshakeTest.js
node spirit/test/deviceRendezvous.js
node spirit/test/deviceListen.js
```

Patch any test that still calls `offer(password, key)` with two args.

Rendezvous must stay green. Slots change who waits, not 66 vs 60.

## Out

- `/device/<hex>`
- Peer-signed `set-device`
- Second key on a row
- `ownedUrls` → claims
- `device.html` cosmetics

`git add` `deviceHandshake.js` and `deviceSlots.js` before the harness.
