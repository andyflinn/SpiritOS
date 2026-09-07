# Invite cycle 1 — apply on current master, do not replace relay.js

Grok’s full `relay.js` was a pre-8c9e458 file with invites bolted on. **Do not use it.** Gates stay. This file is the only spec.

## Land these files

- `spirit/run/js/invites.js` (the module that was missing from the drop)
- `spirit/test/invites.js` (from Grok’s `invitesTest.js`)

## Patch current `relay.js` only

- `const invites = require('./invites');`
- `claim(name, sig, publicKey, clientKey, inviteToken)` — keep `clientKey` where 8c9e458 put it.
- **names-mode only:** if `checkClaim` fails, `invites.match(rootDir, inviteToken, n)`. If match fails, return **the invite error**, not the allow-list error.
- After a successful persist: no. **Consume first.** If `consume` does not burn the row, do not write the peer.
- Do not delete inbox sig, send clientKey, sweep, owner-only census, boolean `peer.owner`, or stale-pending clear.

## Patch current `server.js` / `hub.js`

- `relay.claim(..., body.invite)`
- Hub may forward `body.invite` if the browser sent it. Hub does **not** mint tokens (cycle 2).

## Out of this commit

- keys-mode does **not** require an invite (cycle 4). Extra signed keys still claim. That is still bones.
- No mint route, no zip, no Kamatera cutover.
- `invitedBy` is **provenance**, not a signature check.

## Why names-mode first

Live Kamatera is names-mode. Invites are how `saint` gets in without editing `allow.json`. keys-mode already lets a second key claim; requiring an invite there is the lock that 0003 promised, and that is cycle 4.
