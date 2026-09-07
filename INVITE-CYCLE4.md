# Invite cycle 4 — keys-mode extra claim requires a live invite

Patch current master. Do not replace `spirit/run/js/relay.js`.

## Point

0003 becomes true. After first-claim-is-owner, a new key may claim only with a matching unconsumed unexpired invite. First owner still needs no invite. Two johns = two invites.

## Patch `claim()` keys-mode branch (not firstOwner)

- `inviteToken` required. If missing: `{ ok: false, status: 403, error: 'invite required' }`.
- Then existing match + consume-before-write.
- firstOwner / pending-owner path unchanged (no invite).
- names-mode unchanged (allow-list or invite fallback).

## Tests Claude must update (they assert the old open door)

- `spirit/test/identityPerception.js` — two johns after annie must mint two invites (or this file’s helper) before claim.
- `spirit/test/firstOwner.js` — “second signed key may claim after owner” becomes “second key without invite is refused; with invite is accepted.”
- `spirit/test/inviteRedeem.js` — last check “without token still open” becomes 403 invite required.
- `spirit/test/inviteMint.js` — any extra claim without token must use an invite or expect 403.

Do not weaken `inviteRedeem` mint-and-burn; add the lock around it.

## Out of scope

- zip, email, Kamatera cutover, UI

## Test

```
node spirit/test/inviteLock.js
node spirit/test/inviteRedeem.js
node spirit/test/inviteMint.js
node spirit/test/invites.js
node spirit/test/firstOwner.js
node spirit/test/identityPerception.js
```
