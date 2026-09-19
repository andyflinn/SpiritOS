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
| D1 | a `routingTable.json` from older code: `name` folded into `publicLabel`; the ring's `messages` / `nextId` read and dropped | `spirit/run/js/relay.js` `loadRoutingTable` | alpha | eliminated | 2026-09-19, cycle 3: the JSON reader was replaced by the SQLite store; the one-time import (D8) carries this handling instead |
| D2 | the contacts book under its old name, `relay-state/who.json`: renamed on first read, read in place if the rename fails | `spirit/run/js/contacts.js` `migrateOldName`, `load` | alpha | live | |
| D3 | the unknown-senders policy at its old home, `app/contacts/prefs.json` field `unknown`, read when `preferences.json` says nothing | `spirit/run/js/hub.js` `LEGACY_UNKNOWN_PREFS_FILE` | alpha | live | |
| D4 | invites stamped `consumedAt` by the old `consume`: refused by `match`, drained by `sweepExpired`. Its own comment says it can go once the last invite minted before the change has expired (15 days at most) | `spirit/run/js/invites.js` `match`, `sweepExpired` | alpha | eliminated | 2026-09-19, cycle 3: invites moved to the store; the one-time import (D8) does not carry stamped rows |
| D5 | allow rows spelled the old way: `owner` for `publicKey`, `device` / `devicePublicKey` read (and dropped on the next write) | `spirit/run/js/deviceAuth.js` `parseKeyRow` | alpha | live | |
| D6 | a names-mode `allow.json` (`{ "names": [...] }`), read as an open relay. Cycle 3 removes open mode; this row's handling changes with it | `spirit/run/js/relayAuth.js` `loadAllow` | alpha | eliminated | 2026-09-19, cycle 3 Part B: open mode was removed. Any allow.json without an owner key is simply unclaimed, and a relay whose roll holds members refuses to start on it, so no code is left that is about names mode |
| D7 | preferences naming apps by their old bare ids (`stats`, `jobs`, `app-manager`, …), rewritten to `app/…` at load | `spirit/run/js/client/shell.js` `APP_ID_RENAMES`, `migrateAppIds` | alpha | live | |
| D8 | a relay's `routingTable.json` and `invites.json` from before cycle 3, imported once into `relay-state/relay.db` and renamed `*.imported`; carries D1's and D4's handling. An unreadable file refuses the start rather than importing as empty | `spirit/run/js/relayStore.js` `importLegacy`; its suite `spirit/test/storeImport.js` | alpha | live | |

## Reserved

| id | what | why reserved |
|---|---|---|
