# Device cycle 5 — console on `/device` + slot replace

Andy looks at `/device` after enroll.

## Drop map

| File from Grok | Repo path |
| -------------- | --------- |
| `DEVICE-CYCLE5.md` | `DEVICE-CYCLE5.md` (root) |
| `device.html` | `spirit/run/device.html` (replace the cycle-3 page) |
| `deviceDisplace.js` | `spirit/test/deviceDisplace.js` |

Do not drop `relay.js` / `server.js` / `relayConsole.js`. Patch only what is named.

## Console

`relayConsole.js` already exists. `/device` after a yes is a text box.

- `to` is reserved `relay`
- `from` is the owner label
- Sign `send\n{from}\nrelay\n{text}` with the **device** key in sessionStorage (WebCrypto PKCS8, sig base64 — same as `relayAuth.sign`)
- `POST /api/relay/send` `{ from, to: "relay", text, sig }`
- Print `consoleReply.text` from that 201. Do not poll inbox for this sitting.

## server.js — patch

When `deviceOffer` resolves `ok`, the JSON includes `name: ownerName`. The page needs it to sign `from`. Empty name → page stays on “not now” for send.

## relay.js — confirm, test-gated

`setDevice` already overwrites `devicePublicKey` on the owner row. Cycle 5’s test is the proof: second key in, first key cannot `inbox` or `send`. House key still can. Do not invent a second slot.

If `setDevice` appends instead of replacing, fix it. One field, one key.

## device.html

Taken as dropped. Form stays until 200. Then hide form, show the box. sessionStorage keeps pub/priv/name for that tab only.

## Out

- Pretty UI
- whoBook / chat roster on the phone
- Fan-out to every owned mailbox
- Durable key in IndexedDB
- Mint-by-typing if console already has it; if `help` lists a word, the box may type it — do not add mint HTTP from this page

## Test

```
node spirit/test/deviceDisplace.js
node spirit/test/deviceInbox.js
node spirit/test/deviceSig.js
```

## Andy looks at

`https://spirit.andyflinn.com/device` — after enroll, type `help`, then `status`. You want the same words the desktop console would print. A second device enroll must lock the first phone out; verify that before you trust a hotel tablet.
