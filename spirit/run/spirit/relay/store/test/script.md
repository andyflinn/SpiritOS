# spirit/relay/store/script.js — its own test

The relay's data on disc: one sqlite file, `spirit/state/relay.db` under the relay's root, with two tables, `members`
(the roll, by key) and `invites` (the waiting room). Disc is the only copy; every question is a query. Owed since the
rule *"every production script has its own test"* (goal/G47.1). On scratch roots in the system's temporary folder, real
rows written and read back through the module itself.

## Requirements

- `available()`: true when this Node can load `node:sqlite`.
- `normLabel(label)`: the label trimmed, its case kept; null and undefined are `''`, anything else its string.
- `open(rootDir)`: creates `spirit/state/` and `relay.db` under the root; the store's `path` is that file. One store per
  resolved root: opened again, however the path is written, it answers the same store.
- A member row is `{publicKey, publicLabel, claimedAt, card, faceName, faceEmail, email, emailVerified}`, nothing else:
  no row knows who owns the relay (2026-09-19, Andy: *"a row in the roll doesn't know who the owner is"*).
- `members.put(row)`: stores or replaces the member by key and answers its row, the label as given; no label is `''`.
  Put again with no card it keeps the card it had (a rename must not erase a card, cycle 10, R5); with a card it takes
  the new one.
- `members.get(key)`: the row, or null for an unknown, empty or null key. `members.count()`: the roll's size.
- `members.byLabel(label, limit)`: the holders of the label as `normLabel` makes it, compared exactly (case counts), up
  to `limit`, two when none is given.
- `members.byKeys(keys)`: the known keys' rows in the order asked; unknown and null dropped; nothing is `[]`.
- `members.each(fn)`: the whole roll, in order of `claimedAt`; stops when `fn` answers false.
- `members.remove(key)`: true when a member went, false when none was there.
- `members.setFace(key, name, email)`: true when written; false for a member not on the roll, and false for a name
  another member holds (nothing changes). An empty name collides with nobody, and clearing a name frees it.
  `members.byFace(name)`: its holder, or null.
- `members.setEmail(key, email)`: writes the email as verified (`emailVerified` true); false for a member not on the roll.
- `members.faceLogins(key)`: the member's list `[{hash, until}]`, `[]` when none or not on the roll.
  `members.setFaceLogins(key, list)`: stores it, a non-list as `[]`; false for a member not on the roll.
  `members.byFaceLogin(hash)`: the member holding that whole hash, null for part of one, an unknown or an empty hash.
  The logins go with the row when the member is removed.
- `invites.add(row)`: stores an invite and answers `{token, label, expiresAt, invitedBy}`, `invitedBy` `''` when not
  given; a token already there throws a constraint error and the first stays. `invites.get(token)`: the row or null.
- `invites.all()`: every invite in order of expiry. `invites.byLabel(label)`: every invite with that exact label.
- `invites.remove(token)`: true when spent, false when not there. `invites.removeLabel(label)`: how many went.
  `invites.sweepExpired(nowIso)`: removes those expired before it, answers how many.
- `transaction(fn)`: every write in `fn` lands, and it answers what `fn` answers; when `fn` throws, none lands and the
  throw reaches the caller; the store writes on after.
- On disc: a rollback journal, so after a commit there is no `-journal` file and `bytes()` is the size of `relay.db`.
  Deleted means gone from the file (secure delete): a removed member's label and a spent invite's label are no longer
  in its bytes.
- `close()`: the store answers no more; closing twice does not throw; `open` then answers a new store reading
  everything written before. `closeAll()` closes every open store.
- `openReadOnly(rootDir)`: null, creating nothing, where there is no database; else a store over it that reads, is not
  the cached one, and throws on a write, changing nothing.
- `isDiscFailure(e)`: true for the codes full (13), read-only (8), I/O (10) and cannot-open (14), read by the low byte
  (1544 is read-only); without one of those codes, true when the message says the disc (`database or disk is full`,
  `ENOSPC`, `EROFS` and the like); false for a constraint, a plain error, null and undefined. The real error of a write
  to a read-only store is one; the real error of a duplicate token is not.
- `compact(rootDir, freeMB)`: `{ok: false, why: 'no database yet'}` with no database; refuses, saying why, when `freeMB`
  is under twice the file, the file untouched; otherwise closes every cached store, VACUUMs, and answers
  `{ok: true, before, after, ms}`, `after` the file's new size. No `freeMB` means no check.

## What its test must try to break

A rename that blanks a card; a face name taken from its holder; a login found by part of its hash; a label looser
than exact; a transaction that lands half; a deleted label still readable in relay.db; a closed store that still
answers, or a reopened one that lost data; a read-only store that writes; a constraint error read as a full disc; a
VACUUM run with no room for it, or a file that stays its full size after one.
