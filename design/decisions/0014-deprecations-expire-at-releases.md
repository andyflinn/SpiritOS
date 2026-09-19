# 0014 — Deprecations expire at releases

**Decided 2026-09-19 by Andy.**

> *"When we migrate datasets before official alpha release … after migration
> the old logic must be eliminated. Future alpha users will never encounter
> the formats or logic that existed prior to our migrations."* — and then,
> as the way to do it: *"A time-saving approach before public release: every
> official release must identify expired deprecation status and address it
> with risk-assessment and then either elimination, or backward
> compatibility."*

## The decision

Code that exists only to read or convert an older format — a migration, a
fallback read, a renamed field still accepted — is **deprecated with an
expiry**, and the expiry is an **official release** (`alpha`, then later
ones). It is not eliminated the moment it is written, and it is never left
to live by default.

**At every official release**, before it ships:

1. list every deprecation whose expiry is that release;
2. write a short **risk assessment** for each — who could still hold the old
   format, and what happens to them if the code goes;
3. then **eliminate** it, or **keep backward compatibility** — and record
   which, and why, in the register.

A release with an expired deprecation and no recorded decision does not ship.

## How it is kept

- **[design/DEPRECATIONS.md](../DEPRECATIONS.md)** — the register: one row per
  deprecation, its expiry, where it lives, and the decision once made.
- **A marker at every site in the code:**
  `DEPRECATED(D<n>, expires: <release>)`, greppable, naming the register row.
- **`spirit/test/deprecations.js`** keeps the two in step — every marker has a
  row, every live row has a marker, and the expiries agree. Run with
  `--release <name>` at a release gate, it fails on every row expiring then
  that has no decision.

## Why this and not elimination on the spot

Elimination on the spot means a follow-up commit per migration and a window
in which a deployed box has not yet run it. Batching the decision at the
release gate costs one sitting per release, and the risk assessment is
written where it can be disagreed with. What must not happen is the default:
a shim nobody remembers, read on every boot for ever.
