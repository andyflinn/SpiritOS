# Deprecations

The register [decision 0014](decisions/0014-deprecations-expire-at-releases.md)
requires. Every row is code that exists only to read or convert an older
format. At each official release, every row expiring then gets a risk
assessment and a decision — **eliminate** or **keep** — recorded here. A
release with an expired row and no decision does not ship.

Each row's id appears in the code as `DEPRECATED(D<n>, expires: <release>)`
at every site that belongs to it. `spirit/test/deprecations.js` keeps the two
in step; `node spirit/test/deprecations.js --release alpha` is the gate.

Status: **live** (in the code), **eliminated** (gone; no marker may remain),
**kept** (backward compatibility chosen at a release; the marker stays with a
new expiry).

| id | what it tolerates | where | expires | status | decision |
|---|---|---|---|---|---|
| D1 | a `routingTable.json` from older code: `name` folded into `publicLabel`; the ring's `messages` / `nextId` read and dropped | `spirit/run/js/relay.js` `loadRoutingTable` | alpha | live | |
| D2 | the contacts book under its old name, `relay-state/who.json`: renamed on first read, read in place if the rename fails | `spirit/run/js/contacts.js` `migrateOldName`, `load` | alpha | live | |
| D3 | the unknown-senders policy at its old home, `app/contacts/prefs.json` field `unknown`, read when `preferences.json` says nothing | `spirit/run/js/hub.js` `LEGACY_UNKNOWN_PREFS_FILE` | alpha | live | |
| D4 | invites stamped `consumedAt` by the old `consume`: refused by `match`, drained by `sweepExpired`. Its own comment says it can go once the last invite minted before the change has expired (15 days at most) | `spirit/run/js/invites.js` `match`, `sweepExpired` | alpha | live | |
| D5 | allow rows spelled the old way: `owner` for `publicKey`, `device` / `devicePublicKey` read (and dropped on the next write) | `spirit/run/js/deviceAuth.js` `parseKeyRow` | alpha | live | |
| D6 | a names-mode `allow.json` (`{ "names": [...] }`), read as an open relay. Cycle 3 removes open mode; this row's handling changes with it | `spirit/run/js/relayAuth.js` `loadAllow` | alpha | live | |
| D7 | preferences naming apps by their old bare ids (`stats`, `jobs`, `app-manager`, …), rewritten to `app/…` at load | `spirit/run/js/client/shell.js` `APP_ID_RENAMES`, `migrateAppIds` | alpha | live | |

## Reserved

| id | what | why reserved |
|---|---|---|
| D8 | the one-time import of `routingTable.json` / `invites.json` into SQLite (cycle 3, A2) | written in cycle 3; the row goes live with the code |
