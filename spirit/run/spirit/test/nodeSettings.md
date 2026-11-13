# spirit/nodeSettings.js — its own test

What the owner has decided about their own node, in `spirit/state/node.json`: Andy, *"the node owner must be able to cap
the shadow-roll by disc space"*, and *"a ceiling like available-ram, taken from the startup-configuration, MUST be a
constant to the governor"*. Read once at startup and never written by the node: an owner's bound, not a lever (0015).
Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). Each test writes `node.json`
into a scratch home of its own.

- `filePath` is `<home>/spirit/state/node.json`.
- `DEFAULT_CACHE_MAX_MB` is Andy's 20 (*"20 MBytes = 10 jpeg images from a modern cell phone"*), `MIN_CACHE_MAX_MB` 1.
- `load`: no file is the defaults, no problem, and no file written; the owner's number obeyed; below the floor raised
  to it and said; zero, negative or not a number is the default and said; not JSON is the defaults and said; a field it
  no longer reads is no problem; read once per home, and two homes kept apart.
- `cacheMaxBytes`: the megabytes as 1024 x 1024 bytes.
- The owner's `node.json` is never written, byte for byte.

## What its test must try to break

A node that writes its owner's file (it would become a lever); a floor refused instead of raised; a bad file that
crashes the boot; settings read again mid-run, or shared between homes.
