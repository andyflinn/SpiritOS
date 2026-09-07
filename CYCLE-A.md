# Cycle A — create-invitation in Relay Chat

Patch current master. Do not replace `spirit/run/js/relay.js`.
Kamatera cutover is **not** this cycle.

## Picture (DICTIONARY.md)

- Relay Chat is the chat app.
- Natter is the list of public relay URLs.
- **Owner badge** on a row = signed `GET /api/relay/status` → 200 for this node’s identity.
- **Create-invitation** only if at least one row has the badge. Several → user picks the mailbox. Never “first URL” silently.

## New file (drop)

- `spirit/run/js/ownerBadge.js`

## Patch (do not full-replace unless the file is still the tiny Grok app)

- `spirit/run/app/relayChat/relayChat.js` — bones UI:
  - After Claim has bound a name, probe each Natter URL via hub.
  - If any owned: show Label, Days (1–15), optional speakable Token, mailbox picker if >1, button Invite.
  - Show returned token so Andy can read it on the phone.
  - No token field on the friend’s side yet beyond Claim + invite already on hub (`body.invite`). Add an Invite token input next to Claim.
- `spirit/run/js/hub.js` — if missing:
  - status per configured relay URL (already owner-signed)
  - invite already exists; must take **which URL** when more than one is listed
- `app/natter/relays.json` shape unchanged

## Out of scope

- Pretty title bar / whoBook dropdown (cycle B)
- Zip, email
- Speakable-token generator beyond “user typed the token”
- Cutover of spirit-3

## Test

```
node spirit/test/cycleA.js
node spirit/test/inviteMint.js
node spirit/test/inviteLock.js
```
