# 0009 — Memory is the training set, and it stays readable

**Decided 2026-09-13 by Andy. Measured against `359febe`.**

> if SpiritOS is designed to be a manifestation of the human user. Memory
> of interactions and experiences is a character/behaviour forming
> training set….

> record the issue, and stick with human readable, and adherence to
> implementation constraints, again, until the design is proven. I'd
> rather fork an enterprise-version later if there's money in it.

## The decision

The node's record of what it has experienced is not diagnostics. It is
**substrate** — the thing a manifestation of a person is formed from.

That does not change the storage rules. It **explains** them, and it
raises what they are protecting.

Three constraints, unchanged and now load-bearing for a second reason:

1. **Human readable.** Plain text, openable in an editor, greppable,
   portable, committable.
2. **No database in the core.** A local-disc store is a plugin behind an
   existing api block, never a replacement inside it.
3. **Until the design is proven.** Performance is not a reason to move
   yet; an enterprise fork with money behind it is where that belongs.

## This was already doctrine

[STORAGE-PHILOSOPHY.md](../storage/STORAGE-PHILOSOPHY.md), Andy, May 2026:

> The data **is** the spirit… **The files are the personality. Keep them
> readable. Keep them honest.**
>
> Alternative storage backends (MongoDB, PostgreSQL, etc.) belong in
> **plugins** or external sync tools — **never in the core**.

So 0009 adds no rule. It records *why the existing one is worth more than
it looked*, and corrects a framing this session had drifted into.

**The correction:** the database question was being treated as *"files
now, a database when reads get slow"* — a deferral waiting on a
performance trigger. That is not the position. The position is **files in
the core, indefinitely**; a database is a plugin, and an enterprise fork
is the place a different answer is allowed to live.

## What it makes true of decisions already taken

**Permanence was required, not preferred.** The traffic log's 24-hour
window was removed on 2026-09-13 with the argument that *"the node's own
record of its own traffic should not be the one thing in the system that
forgets."* Under this decision the argument is stronger and simpler:
**a character-forming record that deletes itself is amnesia in the
substrate.** Not a log that forgets — a spirit that does.

**Append-only text was the right shape, and for this reason too.**
`traffic.jsonl` is still readable, greppable, editable, portable and
diffable. It was chosen because permanence made whole-file rewrites
impossible; it *survives* this decision because a binary store would have
broken all five properties at once.

**[R16](../cycles/2026-09-12-transport-below-the-boundary.md) matters
more, not less.** Every packet arrives signed and the signature is
discarded, so `outcome: 'receipted'` is this node asserting something
about itself. If the record is a training set, **provenance is the whole
game**: a memory you cannot verify is one you cannot trust to have formed
you honestly. The distance between *my spirit remembers that* and *my
spirit can show that* is one field on a row.

## The issue this exists to record

**The log holds what crossed the WAN. Experience is larger than that.**

`traffic.jsonl` records what peers said and what this node sent. A
character-forming set of *interactions and experiences* would also hold
what never crossed the wire:

- what was chosen and refused — `unknownSenders` set to `hold`, a peer
  blocked, an invite minted
- what was later reversed
- what was done in apps at all

**Today those exist as STATE, not HISTORY.** `whoBook` knows a peer is
blocked; nothing knows they were blocked on a Tuesday after three
messages, or unblocked a week later. The state is the outcome; a training
set needs the decision.

That gap widens quietly, because state always looks complete. Recorded
here rather than solved: what counts as an experience worth keeping is a
design question, and *"log everything an app does"* is the answer that
sounds right and produces an unreadable file nobody consults.

## What is NOT decided

- **Whether to log decisions as well as traffic**, and at what grain.
  Open, and the substance of the issue above.
- **Where such a record would live.** `traffic.jsonl` is WAN traffic and
  should probably stay that; a second store answers a different question.
- **Retention for anything but the traffic log.** `peerStats` keeps 14
  days on purpose — *"you cannot rebuild a conversation from it"* — and
  that privacy grain was chosen deliberately. Whether a training set
  wants the same restraint is unexamined.

## The cost of waiting

Close to nothing, and the shape is already right. `spirit/test/storeOwnership.js`
holds every store to one owning module, so a plugin can sit behind
`trafficLog`'s api block — `note`, `read`, `arrivals`, `byHash`, `taken` —
without the core knowing. The decision to stay on files does not have to
be revisited to allow one; it only has to be revisited to *require* one.

What waiting costs is read performance on a node with years of history,
and that is a problem to have rather than one to prevent. Two cheap
answers exist inside the file format if it ever bites — an index of
`hash → offset`, and reading the tail backwards, since `since` queries
almost always want recent rows.
