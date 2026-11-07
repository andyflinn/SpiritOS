# Bones — identity vs perception (lab only)

Kept for the identity-vs-perception thinking it records. For how labMaster
works see [design/cleanup/2026-09-11-labmaster.md](../../../design/cleanup/2026-09-11-labmaster.md).
(`spirit/test/labPopulate.js`, which built a lab world in one command, went
in goal/G43.23.)

Not spirit-3. Not pretty UI.

## What this pack is

- `spirit/run/spirit/contacts.js` — the private contacts book on a personal node, rows of the one table `seen` in `node.db` (goal/G40.11)
- `spirit/test/identityPerception.js` — two johns as two keys; captions stay local
- labMaster — sticks, not a new framework

## Unit test

```
node spirit/test/identityPerception.js
```

## labMaster (laptop)

```
node spirit/test/labMaster/labMaster.js
```

Panel: `http://127.0.0.1:65420` (`LAB_MASTER_PORT` names another; the harness uses 45420).

The idea, in lab terms: one lab relay and four avatars (annie, john-a,
john-b, jim). Peers are keyed by public key: two avatars may both carry the
public label `john` and are still two keys; annie's own captions for them
(`lovelyJohn` / `john-work`) are her `myLabel`s and never leave her node.
A relay's owner is written at install (`spirit/state/owner.json`,
goal/G16.8), and every other claim needs an invite the owner mints.
