# spirit/relayAuth.js — its own test

`./relayAuth.js` holds what is relayAuth's own; its keys, signatures and grants are judged where they are used (apiAuth,
contacts, faceHome, relay).

## The node's identity, kept in memory once read (goal/G47.1)

Andy: *"why is the tiny bit of memory to expensive to cache the identity of the node?"*, and of the fix: *"we need a red
so no fool takes your fix out again"*. The node asked for its identity on every owner call, a disc read of
`identity.json` and a parse of its key each time, on its one thread.

In a child process, on a scratch state folder: an identity saved, then asked fifty times, every read of `identity.json`
counted.

- Asked fifty times, it is read from disc once.
- Each caller gets its own copy: what one caller changes, the next does not get.
- After `saveIdentity`, the next ask reads `identity.json` again, and has the new name.

## What its test must try to break

An identity read from disc on every ask; one object shared by every caller; a save that leaves the old identity kept.

## The hint signature goes (goal/G47.1, box v69)

*"A post carries no hints: the node sends none, the hint signature goes, and the relay takes a post with hints no
more."* relayAuth hands out neither `hintMessage` nor `hintsSigned`.
