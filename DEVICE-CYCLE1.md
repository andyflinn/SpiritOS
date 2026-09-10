# Device cycle 1 — password + one slot on the allow pair

Patch current master. No `/device` page. No handshake route. No console on the phone.
Andy does not need a UI look.

`git add spirit/run/js/deviceAuth.js` before the harness (`setupRelayFakes` copies `git ls-files`).

## Decided (do not reopen)

- One device slot. Next handshake will replace it (later cycle).
- Device key is **not** a peer row and does **not** claim a label.
- Relay does not check the password and does not persist it.
- `RESERVED_NAME` stays `relay` only.
- Password lives on the **personal** node in `relay-state/device.json`, never on spirit-3, never in `identity.json`, never in `mailbox.json`.

## New files

| Repo path | Action |
| --------- | ------ |
| `spirit/run/js/deviceAuth.js` | new, drop |
| `spirit/test/deviceAuth.js` | new, drop |
| `DEVICE-CYCLE1.md` | new, root |

## relayAuth.js — patch, do not replace

`allow.json` on disk, keys mode, stays an array. Each row may grow one optional field:

```
{ "keys": [ { "name": "andy", "publicKey": "<house>", "devicePublicKey": "<or omit>" } ] }
```

Old files without `devicePublicKey` still load.

`loadAllow`:

- `byName[name]` remains the **house** `publicKey` string. Do not break firstOwner / mint.
- New: `deviceByName[name]` is the string or `null`.
- `parseKeyRow` in `deviceAuth.js` is the one parser.

`writeAllowKeys(rootDir, keys)` writes `devicePublicKey` when present, omits it when null.

`checkOwner` / `checkSend` / `checkInbox` (keys branch): verify the signature against **any** key from `deviceAuth.keysForName(allow, name)`. Owner house key first is fine; result is the same.

`ownerName` unchanged (first name in `byName`).

`becomeOwner` / first claim: write house key only. Do not invent a device slot there.

No new HTTP route. No packet kind. No hub sweep change.

## Out

- Form on spirit.andyflinn.com
- Long-poll / RAM handshake
- Fast inbox poll
- WebCrypto page (cycle 2, after this is green — confirm Ed25519 on Andy's Chrome then)
- Fan-out to every owned mailbox
- Chat / whoBook on a handheld

## Test

```
node spirit/test/deviceAuth.js
node spirit/test/firstOwner.js
node spirit/test/inviteMint.js
node spirit/test/relayGates.js
```

Expect deviceAuth 20/20 after the relayAuth patch. On unpatched master, `#1.14` / `#1.15` / `#1.18` fail first.

## Next

Cycle 2 is the unlisted form + RAM handshake + window-open fast poll. Not this sitting.
