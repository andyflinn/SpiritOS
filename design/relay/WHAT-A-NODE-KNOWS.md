# What a node knows about a peer, and where it keeps it

**Planning note, 2026-09-21. Measured against `7806b3d`.**

> **Andy:** *"I'm trying to go diligently through all instances where
> knowledge is thrown away blindly, and it costs the relay nothing."*
>
> *"Any peer a node could possibly connect to, the route to it can be
> known to the node."*
>
> *"the node MUST be greedy about route acquisition and updates, the
> (updated) public labels must be part of it."*

This has planning status for the reason `0016` did: it is one rule with
consequences in the node, the relay, the contact book and the wire, and a
list of requirements holds the work without holding the argument.

---

## The rule

**A node learns a route at every opportunity, and policy never gates the
learning.**

Everything below follows from it, including the parts that turned out to
already exist and the parts that turned out to be backwards.

## What was being thrown away

Every one of these had the answer in hand at the moment it discarded it.
None cost the relay anything to carry.

| where | what it held | what it did |
|---|---|---|
| a search answer (`hub.handleSearch`) | `via`, the partner's key, used to look up a URL | kept the URL, dropped the key — so an acquired contact had an address and no route |
| a packet arriving (`peerPost.onRequest`) | the sender's key and the road it came in on | nothing, unless the door said admit or hold |
| the auto-add (`hub.remember`) | the road, written to `relays` as a URL | no route key at all |
| a route announcement (`server.js onRoute`) | the announcing relay's URL, and the key | dropped the announcement for anyone not already a contact; discarded which of my relays announced it |
| an invite or pasted key (`peer.acquire`) | the relay URL the caller named | consulted the cache and stopped |
| a sibling exchange (`relay.js routeReply`) | both ends' keys and labels | announced nothing — only partner forwards did |
| a route announcement's label | the relay knows what its own members are called | sent the key alone |

**The shape repeats:** the information is free where it is discarded and
expensive, or impossible, to recover later.

## Where it goes: the shadow

`seenPeers.js` — keyed by peer, so a peer seen a thousand times is one
row and growth is bounded by distinct people rather than by traffic.

> **Andy:** *"it's not duplication, it's like a browser's cache. it's
> just a shadow and by definition not a duplicate, because it tracks the
> node's traffic with the contacts IT knows."*

**Not the contact book**, because a search result is not a contact and
the book never invents rows — *"a relay may improve what this node knows
about its own contacts and may never add to them"*. Forty strangers from
one search belong somewhere bounded.

**It may guess and may never assert.** A wrong hint costs one attempt;
*"is X on relay R"* is the relay's answer. Not a roster, not a count, not
a membership check, and **no reader outside this node** — what exposing it
would leak is not a relay's membership but whose business this node has
been doing.

## What is built

- **Fed from four places**: a search, a packet arriving (whatever the
  door then decides), a route announcement, and a relay named at
  acquisition. `spirit/test/seenPeers.js`, `spirit/test/routeStash.js`.
- **Spent at acquisition**, after the row exists — no search result
  becomes a route until a person decided to keep the person.
- **Siblings announce**, to both ends, with labels
  (`spirit/test/routerPost.js`). A node cannot infer this: when no relay
  of its own names a key it posts through whichever relay it holds and
  the RELAY decides where the packet goes.
- **Greedy updates**: a field is written when the caller has one and left
  alone when it does not. Fixing a bug of mine — writing every field on
  every call meant an arriving packet blanked the label a search taught.
- **Survives a deleted contact.** Deleting a row is a statement about an
  address book, not about what this node was told.

## Decided

- **`0018`** — the route cache belongs to the machine, not the human. A
  node's readability rule covers what its owner acquired; `server.js` is
  the exemption that was always there and never named.
- **`routes` leaves the contact book.** Base64 relay keys that nobody has
  ever read, and a second copy besides. **Lands with the store**, because
  `hub.handlePost` reads them for hints whenever no relay of this node
  names the target.
- **Labels ride route announcements**, for a relay's own members only. A
  relay is the authority on who is on IT.

## Recommended, not decided

- **Raise or retire `MAX_AGE_MS`.** An hour fits a search somebody is
  still looking at and argues with *"the user may forget all search
  results, the node must not"*. It reads as a consequence of living in
  RAM rather than a decision about forgetting.
- **One store for two needs.** R26 (this) and R16 (the scheduler queue
  surviving a restart) both want node-side persistence, and `node:sqlite`
  is native — but it moves the node's floor from 18 to 22.13.

## Open

- **Label-key tuplets.** Andy: *"not decided yet, but we are trending
  toward label-key-tuplets."* Carrying the pair on the request and reply
  is free of an EVENT and not free of BYTES, and
  `limits.WIRE_OVERHEAD = 246` is measured. **Tried and backed out**
  rather than invalidate a measured constant on an undecided wire change.
- **Cache-first search.** Andy: *"the users peer-searches can first go
  through the nodes live-cache, and bring more responses quicker; the
  part that is posted [to] the relay is only a forced update of the
  nodes contact-cache... a forced update where the scope of the update is
  the search string."* The node answers from the shadow at once and the
  relay query refreshes exactly the rows the query names. Nothing built;
  it changes what a search IS, and the present shape answers once.
- **A failed hint does not un-learn.** A peer who moves relays leaves a
  stale row until something newer overwrites it or it ages out. Cheap to
  live with — one attempt — but "up to date" is best-effort.
- **`via` is still discarded** at `server.js onRoute`, so a node on three
  relays cannot tell which of its own doors proved a route.

## Reconciled with ROUTE-DISCOVERY.md

[ROUTE-DISCOVERY.md](ROUTE-DISCOVERY.md) (2026-09-17, nothing built) asks
a different question — how a relay *finds* a route it does not have, by
asking partners. This asks what a node does with routes it is **already
being told**. They do not conflict, and the order between them has
changed: **most of what that note was for may not be needed as often**,
because a node that keeps what it is handed asks far less.

Three of its open items are answered here, and one is not:

- *"Which route to try, when a key has several — node-side state nobody
  has specified."* The shadow is that state.
- *"A streamed route is not correspondence."* Agreed and now load-bearing:
  `0018` says the cache belongs to the machine.
- *"Negative results need a lifetime."* Still open, and the shadow has no
  concept of a negative result at all.
- *"A partner that claims keys it does not hold can harvest forwards."*
  **Untouched by any of this**, and still the load-bearing one.
