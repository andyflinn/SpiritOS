# SpiritOS Storage Philosophy

**Version:** 0.1 (16 May 2026)  
**Author:** Andy Flinn

> **Status 2026-11-07 (goal/G43.23):** later rulings narrowed "plain JSON
> files" to what the owner acquired. Machine state is SQLite today:
> `spirit/state/node.db` (`spirit/run/spirit/nodeStore.js`, decision 0018;
> Andy: *"we need no peer review for allowing a database to be used for
> the shadow roll. That's a decision."*, nodeStore.js:7-8), which also holds
> contacts since goal/G40.11 and the traffic log; and a relay's
> `spirit/state/relay.db` (`relayStore.js`, cycle 3). `identity.json`,
> `owner.json` and `config.json` stay files.

## Core Principle

The source of truth for a SpiritOS digital personality must be **human and machine readable**, fully inspectable, and easily portable.

## Why Plain JSON Files

- The data **is** the spirit.
- Storage must be transparent and directly editable with a text editor.
- In-memory structures and on-disk representation stay as close as possible.
- Git, backups, inspection, and migration become trivial.

## The Plugin Doctrine

Alternative storage backends (MongoDB, PostgreSQL, etc.) belong in **plugins** or external sync tools — never in the core.

## Conclusion

We removed the generic database driver infrastructure.  
We choose **radical clarity** over premature abstraction.

**The files are the personality.** Keep them readable. Keep them honest.