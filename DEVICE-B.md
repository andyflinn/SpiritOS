# Device B — peer enrolment, one arc

Andy confirmed: no Step A, `device.html` frozen except what B forces, B to done before the next design talk.

Do not start until Andy says **B** and spirit-3 has pulled **and restarted**.

## Order (do not reorder)

| Sitting | What |
| --- | --- |
| **B1** | (3) slot + rate bucket per identity, together. Same sitting: (3.4) bucket on `device-pending`. |
| **B2** | (2) `devicePending` / `deviceAnswer` gated per identity |
| **B3** | (4) `set-device` for a peer row, signed by that peer's key |
| **B4** | (1) second key on a peer row; `inbox` / `send` accept either |
| **B5** | (5) node watches *"relays I hold a claim on"*, not only `ownedUrls` |

Rendezvous arithmetic is unchanged. `deviceRendezvous.js` must stay green or the commit message says why.

## Frozen

`device.html` look: attempt counter, elapsed clock, countdown. No cosmetic edit.

B1 may add `name` on `POST /api/relay/device` so the slot has a key. If `name` is omitted, `relay.js` uses the owner label so today's owner page still works.

`/device/<hex>` is B2+ (page address). Not B1.

## B1 drop map

| File from Grok | Repo path |
| --- | --- |
| `DEVICE-B.md` | `DEVICE-B.md` (root) |
| `DEVICE-B1.md` | `DEVICE-B1.md` (root) |
| `deviceHandshake.js` | `spirit/run/js/deviceHandshake.js` (replace) |
| `deviceSlots.js` | `spirit/test/deviceSlots.js` |

## Later sittings

No files until B1 is green and Andy opens B2.
