# spirit/invites.js — its own test

The relay's invites, the `invites` table in `relay.db`: a waiting room, not a guestbook (Andy: *"as soon as that label
claims itself and deposits its key, the label must be deleted from invites, and move to the key."*). Owed since the
rule *"every production script has its own test"* (goal/G47.1, box v72). Run in process on a scratch root.

- `normalizeDays`: whole days 1-15; nothing, zero or junk is 7. `normalizeToken` trims. `newToken`: 32 hex, new each
  time.
- `add`: refuses no label; stores and answers the row with token and label trimmed and the inviter; mints a token when
  none is given; with no expiry, lives the normalized days.
- `match`: ok with the invite for its token and label; 403 `invite required`, `invite not found`,
  `invite label mismatch`, `invite expired`.
- `consume`: answers the row and deletes it, so a spent token is `invite not found`; null for an unknown token.
- `revokeInvite` (Andy: *"we need revokeInvite(label)"*): every invite of that label, unclaimed ones too, the count
  answered; no label revokes nothing.
- `sweepExpired`: removes the expired, keeps the live, at the time given or now.

## What its test must try to break

A spent invite kept (the guestbook back); a spent token answered as "already used"; a day count stored other than the
one normalized; a label mismatch let through; an expired invite matched or left after a sweep.
