# Invite cycle 2 — mint. Patch current master. Do not replace relay.js.

## Repo paths

- replace `spirit/run/js/invites.js` (adds `mintMessage`)
- add `spirit/test/inviteMint.js`
- patch `spirit/run/js/relay.js` — add `mint`, do not strip gates
- patch `spirit/run/js/server.js` — POST `/api/relay/invite`
- patch `spirit/run/js/hub.js` — POST `/api/hub/invite` signs with local identity

## `relay.mint(ownerName, label, days, sig)`

- `checkOwner(allow, ownerName, sig)` is the wrong message. Verify owner key from `allow.json` keys against `invites.mintMessage(label, days)`.
- days default 7, clamp 1–15.
- label: existing name rules, not reserved `relay`.
- On ok: `invites.add(rootDir, { label, days, invitedBy: ownerName })` and return `{ ok, status: 201, invite: { token, label, expiresAt, invitedBy } }`.
- Stranger / bad sig → 403.
- names-mode mailbox has no owner key → 403 `no owner key on this relay`.

## HTTP

- POST `/api/relay/invite` body `{ name, label, days, sig }`
- POST `/api/hub/invite` body `{ label, days }` — hub loads identity, sets name + sig. Does not invent tokens locally.

## Out of scope

- zip, email, keys-mode lock (cycle 4), Kamatera cutover
- git-add `spirit/run/js/invites.js` already tracked; any new file under `spirit/run/js/` must be tracked before fake-node tests

## Test

```
node spirit/test/inviteMint.js
node spirit/test/invites.js
```
