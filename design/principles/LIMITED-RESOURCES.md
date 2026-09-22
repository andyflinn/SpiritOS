# A limited resource is released before it is claimed

**Stated by Andy, 2026-09-22**, during cycle 9, on being told that the lab
relay and the public relay share one box and that shrinking one is how you
make room in the other:

> **Andy:** *"it's like member slots, you must evict before adding new
> ones. a limited-resource principle."*

And, on the same rule seen from the other end — an owner lowering a figure
under members who are already on the roll:

> **Andy:** *"the owner must evict before shrinkage."*

A principle, not a mechanism. It is the reason behind four refusals that
were each argued separately, and it decides the cases none of them names.

---

## The rule

**Nothing is taken from a full resource. The holder releases first, and
the release is always a deliberate act aimed at a particular thing.**

A request that would exceed what is left is **refused whole**, with the
obstruction named: how much is held, by whom or by what, and how much was
asked for. The refusal is not a failure to serve — it is the system
declining to decide, on the owner's behalf, what should be given up.

## The invariant, which is the half that matters

**The system never frees on anybody's behalf.**

- No eviction as a side effect of a number changing.
- No silent clamp written back into a file the owner wrote.
- No borrowing from a neighbour who has not yielded.
- No oldest-first, least-recently-used, or "probably fine" reclamation of
  something a person acquired on purpose.

This is what separates the principle from ordinary capacity management. A
cache may evict; a **roll of people** may not, because a row on it is
somebody's standing, not a copy of something retrievable. Where the two
meet — a node's cache of people it has added — 0021 rules it as standing,
not as cache.

## Where it already bites, at `0bf76b4` plus cycle 9

- **A claim on a full relay.** `spirit/run/js/relay.js:1551` — *"THE DISC
  BOUND BITES HERE"*: past the configured disc figure, a claim is refused
  507 before the invite burns, and nobody on the roll is touched.
- **A shrink under the membership.** `relay.js:646` and `:657` — the two
  strandings, by disc and by allowance. The answer names the gap and
  refuses; the owner removes members with `removePeer` or `revoke` and
  asks again.
- **A node's memory of people.** `spirit/run/js/spiritErrors.js:176` —
  *"memory is full of the people you added"*, decision 0021. The node will
  not choose whom to forget.
- **Two relays on one box.** `bash/RELAY-HOST.md:204` — *"A second relay is
  a second clone, not a second machine"*. Each measures the same machine
  and neither knows the other exists, so the lab relay's figures come down
  before the public relay's go up. Nothing does that reallocation
  automatically, and nothing should.

## The one exception, and why it is not one

A boot-time **clamp** looks like the system taking a decision: a relay
whose configured figure no longer fits comes up on what the box can give
rather than refusing to start (`spirit/run/js/relayConfig.js:115`).

It is not an exception, because **nothing is released and nothing is
written**. The file keeps what the owner asked for, the relay runs
smaller for as long as the box is squeezed, the owner is told both
numbers, and no member is dropped. It is the system declining to enforce
an accounting rule by taking everybody's service away — the same instinct
as the rule itself, pointed at uptime.

## What it forbids, so a later session does not propose it

- An `evictOldest` on any roll, however well-intentioned.
- A "force" or "confirm" field that lets a shrink strand members in one
  step. Andy declined exactly this offer on 2026-09-22.
- A relay that lowers a sibling's figure to raise its own.
- Writing a clamped figure back over the owner's configuration.
