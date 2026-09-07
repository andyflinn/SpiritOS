# Invite cycle 3 — redeem on the same mode that minted

Patch current master. Do not replace `spirit/run/js/relay.js`.

## Point

Cycle 2 can mint in keys-mode and consume only in names-mode. Cycle 3: if a claim in **keys-mode** carries a live `inviteToken`, match + **consume-before-write** exactly as names-mode does. No token still succeeds (cycle 4 is the lock).

## Patch `spirit/run/js/relay.js` `claim()`

In the keys-mode branch, after the sig checks pass and before persist:

- If `inviteToken` is present: `invites.match(rootDir, inviteToken, n)`. On fail, return that error (do not fall through to 201).
- Consume before writing the peer. If consume returns null, do not write the peer.
- If `inviteToken` is absent: current behaviour (extra signed key still claims).

Do not change inbox, send, sweep, census, mint.

## HTTP

Already forwards `body.invite`. No new route.

## Out of scope

- Requiring a token in keys-mode (cycle 4)
- zip, Kamatera cutover

## Test

```
node spirit/test/inviteRedeem.js
node spirit/test/inviteMint.js
node spirit/test/invites.js
```
