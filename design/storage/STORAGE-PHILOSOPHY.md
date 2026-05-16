# ZS4 Storage Philosophy

**Version:** 0.1 (16 May 2026)  
**Author:** Andy Flinn

## Core Principle

The source of truth for a ZS4 digital personality must be **human and machine readable**, fully inspectable, and easily portable.

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