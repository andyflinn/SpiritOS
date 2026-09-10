# Device cycle 3 — listening window + `/device` form

First sitting Andy looks at.

Also finish cycle 2 leftover: `setDevice` copies every non-owner `allow.json` row through and only changes the owner row.

`git add` every new run module and `device.html` before the harness.

## Drop map

| File from Grok | Repo path |
| -------------- | --------- |
| `DEVICE-CYCLE3.md` | `DEVICE-CYCLE3.md` (root) |
| `device.html` | `spirit/run/device.html` |
| `deviceTick.js` | `spirit/run/js/deviceTick.js` |
| `deviceListen.js` | `spirit/test/deviceListen.js` |

## deviceAuth.js — patch, do not replace

`device.json` gains `listening` (boolean, default false).

- `load` / `save` / `emptyDoc` carry it
- `setListening(rootDir, on)` 
- `deviceTakeMessage(name)` → `'device-take\n' + name`  
  House key signs this for `GET /api/relay/device-pending` and `POST /api/relay/device-answer`. A status signature must not work.

Fix the module header: `device.json` is personal-node only; the **module** is also loaded on a --relay.

## relay.js — patch

`GET`/`POST` helpers can stay in server.js. The box already has `deviceOffer` / `deviceTake` / `deviceReply` / `setDevice`.

`devicePending(name, sig)` — new export:

- Verify `deviceTakeMessage(name)` with the **house** key only
- Return `deviceTake()` or `{ }`
- Do not return the slot to a device key or a stranger

`deviceAnswer(name, accepted, sig)` — same signature gate, then `deviceReply(!!accepted)`.

`setDevice` — rewrite **only** the owner row; copy every other allow row unchanged.

## server.js — patch

`--relay` allowlist today 404s anything that is not `/`, `relay.html`, favicon, `/api/relay/*`. Add:

- `GET /device` and `GET /device.html` → `spirit/run/device.html`
- `POST /api/relay/device` body `{ password, devicePublicKey }` → `relay.deviceOffer(...)`, hold until the promise settles, JSON
- `GET /api/relay/device-pending?name=&sig=` → `relay.devicePending`
- `POST /api/relay/set-device` body `{ name, devicePublicKey, sig }` → `relay.setDevice`
- `POST /api/relay/device-answer` body `{ name, accepted, sig }` → `relay.deviceAnswer`

Wrong password, closed window, timeout: body `{ "error": "not now" }`, status 403. No other string.

Personal node (`not --relay`) does **not** serve `/device` as a public enroll page. Loopback may still send the file if `fsPath` already would; do not advertise it.

## hub.js — patch

- `GET /api/hub/device` → `{ password, listening }` after `ensurePassword`. Loopback only, same as every hub route.
- `POST /api/hub/device-listen` body `{ on: true|false }` → `setListening`, start or stop a **2s** timer that calls `deviceTick.tick(rootDir, ownedUrls, requestFn)` with the existing relay HTTP helper. Owned URLs from the badge summary already used by `handleStatus`.
- Timer must not run when `listening` is false. Stolen password is inert unless the window is open.

Do not put the password in mailbox.json. Do not use `sweepInbox` as the carrier.

## natter.js — patch

On an **owned** expanded row (same place as Invite), add:

- Copy password (from `GET /api/hub/device`)
- Button **Listening on** / **Listening off** (`POST /api/hub/device-listen`)
- One line of copy: the form is `https://<that-host>/device` and only works while listening is on

No panel when `ownedUrls` is empty. Andy looks at this.

Relay Chat is untouched.

## device.html

Taken as dropped. Same-origin `POST /api/relay/device`. One password field, `autocomplete="current-password"`. Ed25519 in the tab; private key stays in sessionStorage, never in the POST. Unlisted, `noindex`.

## Test

```
node spirit/test/deviceListen.js
node spirit/test/deviceInbox.js
node spirit/test/deviceHandshakeTest.js
node spirit/test/deviceAuth.js
```

## Andy looks at

1. Personal shell, Natter, owned row: Copy, Listening on.
2. Other tab: `https://spirit.andyflinn.com/device` (not `/`). Paste, submit.
3. Listening off. The form must then say `not now`.

Do not cut over anything on spirit-3 until that three-step works on a lab mailbox first. Live VPS is optional after Andy says the UI is right.
