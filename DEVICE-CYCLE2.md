# Device cycle 2 — read/send as the slot + RAM handshake

Patch current master. No pamphlet field. No shell *Add a device* window.
Andy has nothing new to look at in the spirit-shell. `/device` is **not** this sitting.

`git add spirit/run/js/deviceHandshake.js` before the harness.

## Why

Cycle 1 made `checkOwner` accept the device key. Live `inbox()` and `send()` in `relay.js` still prove against **the peer row's house key only**, so a phone can own and still not read or write mail.

## New files

| Repo path | Action |
| --------- | ------ |
| `DEVICE-CYCLE2.md` | new, root |
| `spirit/run/js/deviceHandshake.js` | new, drop |
| `spirit/test/deviceInbox.js` | new, drop |
| `spirit/test/deviceHandshake.js` | new, drop |

## relay.js — patch, do not replace

### `inbox()`

After `resolveParty`, keep the existing `checkInboxKey(peer.publicKey)` path when that key is the caller.

**Add** (before giving up): if `deviceAuth.keysForName(allow, label)` contains a key that verifies `checkInboxKey(thatKey, n, sig, atMs)`, accept the read. Filter stays on the **house** peer row (`to === andy` / `toKey === house key`). Device has no row.

Do not call `claim`. Do not write a peer.

### `send()` keys-mode branch

Today it verifies `src.peer.publicKey` when the peer has a key, so `checkSend` never runs for `andy`. Change that branch: verify against **any** of `keysForName(allow, fTok)`. On success, stamp `fromKey` from `src.peer.publicKey` (the house). Device bytes do not appear on the wire.

### `setDevice(name, devicePublicKey, sig)` — new export

- Name must be `ownerName(allow)`.
- `sig` verifies `deviceAuth.setDeviceMessage(devicePublicKey)` with the **house** key (`byName[name]`), not the current device key.
- A status signature is refused.
- `writeAllowKeys` one row: existing `publicKey`, new `devicePublicKey`. `reloadAllow()`.
- Replace the slot if one is already there.
- Return `{ ok, status }`.

### RAM slot on the box

One `deviceHandshake.createQueue()` per `createRelay`. Export:

- `deviceOffer(password, devicePublicKey)` → Promise (the held POST)
- `deviceTake()` → `{ password, devicePublicKey }` or `null`
- `deviceReply(accepted)` → unblocks the offer

Relay **does not** call `passwordsEqual`. Tests / later hub do that on the personal node.

No write to `mailbox.json`. No packet kind.

## Out

- `GET /device`, `device.html`, pamphlet password field
- `server.js` routes (cycle 3)
- hub sweep / fast poll / listening window
- WebCrypto page
- fan-out across owned URLs
- whoBook / chat on the handheld

## Test

```
node spirit/test/deviceInbox.js
node spirit/test/deviceHandshake.js
node spirit/test/deviceAuth.js
node spirit/test/firstOwner.js
node spirit/test/relayGates.js
```

On unpatched master, `deviceInbox` fails at `box.setDevice` is not a function, then at device send / device inbox.

## Next

Cycle 3 is the unlisted form + server routes + shell window that sets listening and polls `deviceTake` every ~2s. Not this sitting.
