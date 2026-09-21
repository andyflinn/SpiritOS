# 0021 — Choosing is a mark on what the machine remembers

**Decided 2026-09-21 by Andy. Measured against `b5c4c34`.**

> **Andy:** *"the peer-list is a "choice" now … the implication is: the
> user has no direct say in what the machine remembers, ignoring means
> only: mark this row as "ignored"."*

## The decision

**The node remembers every peer it meets. The user's peer list is a mark
on that memory, not a second memory.** Choosing someone protects their row;
not choosing them leaves it to the space the owner gave the node.

## The rules, as given

**1. Nothing is forgotten while there is room.**

> *"I don't see why the node should throw away memories when the 20
> Megabyte cap is not exhausted yet..... It would be a mistake we're trying
> to rectify."*

The 30-day expiry goes (`MAX_AGE_MS`, `seenPeers.js:156`). Space is the
only eviction. Age still decides *who goes first* — the space sweep already
takes the least recently seen (`nodeStore.js:342`, `ORDER BY seen ASC`) —
but it no longer decides *whether*.

**2. The mark is the protection, and it is ordered.**

> *"it's the chosen-mark that gives protection from eviction, if the
> memory overflows. the shedded rows will first be ignored, then held, once
> the memory is full with 'added' statuses no more can be chosen/added
> until eviction by blocking or ignoring...."*

Under space pressure the node sheds, in order:

| order | row | why it may go |
|---|---|---|
| 1 | unchosen | nobody asked for it |
| 2 | ignored, blocked | *"what's the point of storing ignored rows when all the space is used by chosen ones?"* |
| 3 | held | a stranger waiting to be decided about |
| — | added | **never.** A full memory refuses the next add instead |

**3. When it is full, that is reality, and the owner has two remedies.**

> *"it's just reality. if the user chooses everybody, then he'll run out of
> space: two options. increase max_space in info or wherever. or kill some
> contacts."*

Raise the cap (`cacheMaxMB`, R31), or let people go — remove them, or
block or ignore them, which hands their rows back to the sweep. At
~577 B a reachable peer, 20 MB is about **36,000 added people**: a ceiling
the owner would notice, not one they trip over. It also means no script can
add its way past what the owner gave the box.

**4. It is an interface, and nothing behind it is visible.**

> *"The shape must be bound to a node-api, nobody is supposed to know how
> the node miraculously coughs up memories about chosen (or not) peers...."*

Apps ask; the node answers. The verbs already exist and already are the
only way in — `app/contacts/contacts.js:13-17` names them: `peer.list`
for the list, `contact.accept` `.block` `.unblock` `.label` `.forget` for
the marks, `contact.senders` `.setSenders` for who is heard. Whether the
marks live in a column, whether an index serves the list, whether
`contacts.json` survives — all of it is behind that wall and may change
without an app noticing. This is 0020's line applied to the list: the
answer crosses, the store does not.

> *"that means no new interface required for now."*

**No new verb.** Every mark already has its door: `contact.accept` adds,
`contact.block` and `.unblock` block, `contact.forget` removes, and a
stranger dropped under *Ignore* (`contact.setSenders`) is marked `ignored`
by the node itself, at the door. An R39 search from memory answers through
the `peer.*` verbs it already has.

## What the memory is for

> *"thing is. if the userbox is offline, search can revert to memory....."*

**Why keeping everything the space allows is worth it:** a search that
cannot reach a relay answers from what this node remembers, instead of
failing. Today search is a wire verb (`peer.list`, `peer.find` — "fails
the same way when the box is offline", `server.js:1490-1491`), so an
offline node knows nothing it has not been told this minute. With the
memory kept, it knows everyone it has met, with a label and a last-seen
age. The answer says it came from memory and how old it is — a value
crossing, not the store (0020).

> *"in fact if search fans out to all bound relays first, why not to the
> memory also?"*

**So memory is one more source in the fan-out, always** — not a fallback.
Offline it is the only one that answers; online, a relay's live row wins
over the remembered one for the same key.

> *"the relays result will take precedence until timeout()"*

The relays lead; when the wait ends, memory fills in what no relay said.

## What it supersedes, marked

- **R4, its age half.** "Two evictions: cache-limit and last seen" becomes
  one eviction, ordered by last seen.
- **0018's split** between the book (readable file) and the shadow
  (machine data). The book is now a mark on the shadow, reached only by
  verb; where it is stored is no longer a decision.
- **`js/contacts.js:449-452`, "the block survives".** Under pressure, it no
  longer does: a blocked row is shed with the ignored ones. The cost, stated
  so nobody rediscovers it: a shed block lets that peer back in as a
  stranger — dropped at the door under *Ignore*, but a waiting row again
  under *List them*.
- **The words on screen.** *"Ignore — No row"* (`app/contacts/contacts.js:75`) was
  never true of the machine; it becomes a mark. UI session.

## Recommended, not decided

- **Shape behind the wall:** a `choice` on the shadow row (none, `held`,
  `added`, `ignored`, with blocked as a flag beside it) and a partial index
  on the chosen ones. The eviction reads the order above off that one
  column.
- **The refusal** when full is a catalogued code (`spiritErrors`), so an
  app can say *why* an add failed without knowing about a cap.

## Open

- Whether raising the cap from Info means the node writes `node.json`,
  which R31 said it never does. UI session; the rule above does not depend
  on it.

**Built as R38.**
