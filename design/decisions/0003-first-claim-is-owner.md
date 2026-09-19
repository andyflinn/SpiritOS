# 0003 — First claim is owner; installer names the claimer

> **Amended 2026-09-19 (cycle 3, Part B): first INVITED claim is owner.**
> Decided by Andy (NODE-AND-RELAY, "The first claim needs a token").
>
> - **`node install.js`** at the repo root, run over SSH on the VPS, asks
>   for the owner's name and mints an **owner invite**: a long random token,
>   shown once in that session and never printed by the relay.
> - An **UNCLAIMED** relay (no owner in `allow.json`) accepts exactly one
>   claim: a signed claim presenting that invite. It becomes the owner and
>   writes `allow.json`, as before. Every other claim is refused (`owner
>   invite required`), including one with an ordinary invite. The owner
>   invite is marked `invitedBy: '(installer)'`.
> - `install-public-relay.js` and `pending-owner.json` are **gone**. They
>   reserved a NAME with no secret behind it. `open` mode is gone too.
> - A relay whose `relay.db` holds members but whose `allow.json` has no
>   owner **refuses to start** (exit 78). Recovery is SSH, not the wire.
> - Lab and test relays mint the owner invite in process
>   (`invites.mintOwner`, `spirit/test/ownerClaim.js`); they never run the
>   installer.
>
> The text below is the decision as first made. Steps 1, 3 and 4 describe
> the name reservation this amendment replaced. The `Files` list is
> superseded by: `install.js`, `spirit/run/js/invites.js` (`mintOwner`),
> `relay.js` (`claimAttempt`), `relayServer.js` (the refusal),
> `spirit/test/firstOwner.js`, `spirit/test/ownerToken.js`.

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

   "Later names need that owner" is `invites.json` (consume-on-claim),
   not today's keys mode — which still lets any signed key claim a free
   name, and must, because that is how two johns work.

Reserved name `relay`: owner sends to it; process replies in the owner
inbox. `GET /api/relay/status` is owner-only (signed).

## Files

- `install-public-relay.js` at repo root — writes pending-owner
- `spirit/run/js/relayAuth.js` / `relay.js` / `hub.js`
- `spirit/test/firstOwner.js`

`pending-owner.json` is gitignored with the rest of `relay-state/`.
