# 0003 — First claim is owner; installer names the claimer

## The process you want

1. Rent a VPS. On the clone:

   ```
   node install-public-relay.js andy
   ./bash/http-to-https
   ```

   The name argument is the **only** name that may take first claim.
   Knowing the IP is not enough; the stranger also needs that name.

2. You know the address first.

3. From the work-box shell (`http://127.0.0.1:65432` Relay Chat), Claim
   that same name.

4. That name + that laptop’s key become owner. The installer file
   `relay-state/pending-owner.json` is deleted. `allow.json` becomes
   `{ "keys": [{ "name": "andy", "publicKey": "…" }] }`.
   Later names need that owner. A stranger cannot take `andy` without
   the key, and cannot take `eve` because it was never the pending name.

Reserved name `relay`: owner sends to it; process replies in the owner
inbox. `GET /api/relay/status` is owner-only (signed).

## Files

- `install-public-relay.js` at repo root — writes pending-owner
- `spirit/run/js/relayAuth.js` / `relay.js` / `hub.js`
- `spirit/test/firstOwner.js`

`pending-owner.json` is gitignored with the rest of `relay-state/`.
