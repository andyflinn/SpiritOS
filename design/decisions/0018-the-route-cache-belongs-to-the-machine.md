# 0018 — The route cache belongs to the machine, not the human

**Decided 2026-09-21 by Andy. Measured against `c8eb997`.**

> **Andy:** *"the route cache belongs to the machine, not the human."*
>
> *"the routing cache is information that belongs to the network, it isn't
> information that the user acquires or cares about: The executable
> server.js is conceptually not readable by a human."*
>
> *"since it could grow as large as the relay's member roll, it may have
> to optimize access, and since it's NOT directly for the user, it is
> exempt from human readability."*
>
> *"This is already a decision. rules and docs must be retrofitted."*

## The decision

**A node's human-readability rule covers what its owner acquired. It does
not cover what the network produced.**

The founding premise
([NODE-AND-RELAY](../principles/NODE-AND-RELAY.md)) reads:

> *"The node is a digitisation of its owner's spirit — human readable, the
> user-experience expression of the original SpiritOS concept… Relays on
> the other hand are a support framework… They shouldn't be bound by
> 'human-readable' constraints."*

That has been read as *node disk = readable, relay disk = not*. **The line
is not the box. It is whose information it is.**

| | whose | readable |
|---|---|---|
| contacts, writing, media, the traffic log | the owner acquired them | **yes** — a person can open these and recognise their own life |
| the route cache | the network produced it | **no** — it exists because relays and nodes spoke |
| `server.js` | the machine's | **no**, and nobody has ever argued otherwise |

## The contact row was the counter-example all along

> **Andy:** *"the hints are removed from the users contacts. (let's admit
> it: they [are] not human-readable, in reality)"*

**Decided: `routes` leaves the contact book.**

A contact row holds `routes`: base64 Ed25519 relay keys, eight of them,
newest first. **Nobody has ever read one.** They are machine data sitting
in a human-readable file, claiming the protection of a rule they never
satisfied — which is what makes this decision obvious in hindsight rather
than new.

They are also a **second copy**. The shadow holds every route a contact
row could hold, plus the ones for people who are not contacts, so the two
can disagree and the book is the one that goes stale.

**It lands with the store, not before.** `hub.handlePost` reads
`row.routes` for hints whenever no relay of this node names the target —
the foreign-peer case exactly. The shadow lives in RAM, so removing
`routes` before R26 would leave a foreign contact unreachable after every
restart until something re-taught the route. Decided; sequenced.

## Why it was always true

**`server.js` is the proof the exemption already existed and was never
named.** It sits on a node's disk, it is text, and no one has ever claimed
the readability rule obliges it to be prose. It belongs to the machine.

So the question to ask of anything on a node's disk is not *"can a human
read this"* but **"did the owner acquire it, and would they care?"**

## What it licenses, and what it does not

**Licensed:** `seenPeers` — the shadow of a node's own traffic, keyed by
peer — may be stored in whatever shape serves the machine. It can grow as
large as a relay's member roll, and a file rewritten whole in a layout
chosen for a reader who does not exist is a cost with no return.

**Not licensed: everything else on a node's disk.** Contacts stay
readable. The traffic log stays readable and permanent — Andy:
*"the log should be permanent. period."* —
and [A-CORRESPONDENT-NODE](../principles/A-CORRESPONDENT-NODE.md) rests on
exactly that: *"permanent, human-readable, portable, owned by each party
separately, held by no third party."* **This decision does not touch it.**
A corpus is the owner's; a routing table is not.

## Two things checked rather than assumed

**The dependency clause survives.** The same premise says a node *"can
afford no dependencies outside native node.js"*. `node:sqlite` is built
into node, so an indexed store does not breach it.

**It moves the floor, and that is the real cost.** `package.json` requires
`node >=18`; `relayServer.js` refuses to start below **22.13**, which is
where `node:sqlite` arrived. An indexed store on the NODE raises every
user's minimum to 22.13 — on a machine they own and install themselves.

## Decided 2026-09-21 — the database is allowed, and it needs no review

> **Andy:** *"we need no peer review for allowing a database to be used for
> the shadow roll. That's a decision."*

**The store is granted here, not deferred to a sitting.** `CLAUDE.md` makes
a new persist shape a team review; this decision spends that review in
advance for this one shape, because the argument for it is already in this
record and a review would re-derive it.

**And the floor moves with it**, because there is no second option: the
founding premise allows *"no dependencies outside native node.js"*, so a
database means `node:sqlite`, and `node:sqlite` means **22.13**. Recorded
as following from the grant rather than as a separate ruling — said here so
it can be vetoed in one word if it was not intended.

**What it unblocks**, which is why this was the keystone: the shadow's
store (cycle R26), `routes` leaving the contact row (R1's second half), the
post queue surviving a restart and becoming a table (R16), the row's
provenance (R29), presence dated on it (R30), and the owner's disc cap
(R31). **Six rows, on one sentence.**

**What it does not grant.** A store for the shadow, and the node-side
things named above that share it. Not a licence for a database wherever one
would be convenient, and not a change to what stays a readable file:
`identity.json`, `allow.json` and `config.json` are *"constant, tiny, and
the ones an owner may have to read or restore over SSH"*
(`relayStore.js:27`).

## Retrofitted

- [NODE-AND-RELAY](../principles/NODE-AND-RELAY.md) §Premise — amended in
  place, stating the ownership test and naming `server.js` as the
  exemption that was already there.
- `spirit/run/js/seenPeers.js` — the header carries the rule where
  somebody would go to add a reader.
- [the gap cycle](../cycles/2026-09-21-filling-the-gaps-request-budget.md)
  R26 — the store, its shape, and its floor.
- [A-CORRESPONDENT-NODE](../principles/A-CORRESPONDENT-NODE.md) —
  **checked and unchanged.** Its readability claim is about the traffic
  log, which is the owner's.
