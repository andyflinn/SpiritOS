# 2026-09-19 — the relay's data on disc, and the owner's token

**Status: OPEN. Part A (disc) done, ten requirements. Part B (the owner's
first-claim token) not started; its requirements are written here when it
is built, in its own commit.** Scaffolding cycle 3 of the build sequence
([NODE-AND-RELAY.md](../principles/NODE-AND-RELAY.md), *Build sequence*),
amended by Andy:

> *"Can we amend cycle 3 to demand that storage is actually moved from RAM to
> DISC, and RAM must become a DISC-client?"*

Before this cycle `relay.js` loaded the whole roll into a `peers` map at boot,
rewrote `routingTable.json` whole on every change, read the roll whole in
seven places, and sent every member the whole roll on connect
(`streamRoster`). Standing rule: RAM, the most expensive resource, managed
with utmost care.

## Part A — disc is the only copy, RAM is its client

### R1 — one store, three tables

`js/relayStore.js`: `node:sqlite` at `relay-state/relay.db`. `members` (by
key, label indexed for search and display), `invites`, `partners` in the §5
shape (by relay key, with a status; today's partnerships are `partnered`,
cycle 5 adds the rest). Rollback journal, not WAL, with `synchronous=FULL`:
after every commit the data is in `relay.db` and nowhere else, so a file copy
cannot catch it half-written. `secure_delete=ON`: a deleted row is zeroed in
the file, so "the relay forgets" is true of the disc. identity, allow and
config stay files.

**Verify:** `spirit/test/relayStore.js` — CRUD by key, duplicate labels, the
cursor, all-or-nothing, a removed label unreadable in the file, reopen.

**Status:** DONE

### R2 — the one-time import, marked deprecated

On first open, a pre-cycle-3 `routingTable.json` and `invites.json` are
imported in one transaction and renamed `*.imported`. `name` becomes
`publicLabel`, spent invites are not carried, a member's partner flag
becomes a `partnered` row. **An unreadable file refuses the open, and the
relay's start, and is left where it was.** Reading it as empty would open a
relay that has quietly forgotten its members, the same failure B4 refuses
over. `DEPRECATED(D8, expires: alpha)`, which absorbs D1 and D4 (both
eliminated, [DEPRECATIONS.md](../DEPRECATIONS.md)).

**Verify:** `spirit/test/storeImport.js`

**Status:** DONE

### R3 — relay.js is a disc client

The `peers` map is gone. Every whole-roll read is a query: by key, by label
(indexed, limited), count, and search streamed from a cursor through
`peerSearch.open(q, SLOTS).offer(row)`, which keeps only the best rows.
The only thing resident is **the rows of connected members** (Andy: cache
active members, bounded by the connection allowance). The cache fills on
stream open, empties on close and on eviction, and is refreshed on rename.

**The walk does not block** (Andy: *"the nature of all wire comms is
asynchronous, and blocking hurts the resources of relays"*). Search reads
the roll a page at a time (`members.page`, `SEARCH_PAGE` = 1,000, about 5 ms
a page), with the event loop between pages (`walkRoll`). Pages are keyed, so
nothing is held between them. A roll smaller than one page still answers in
the same turn. *This replaces the first version of this requirement, which
walked the whole roll in one synchronous pass: RAM-flat, but a 100,000-member
search stalled the relay for about 550 ms.*

**Verify:** `spirit/test/diskClient.js` — 10,000 members against 10: well
under 512 KB apart where a resident roll measured 2.1 MB; search ranks across
all of them; a request arriving mid-search is answered while the walk is
still going; a stranger is refused without walking the roll; a connected
member posts without a disc read.

**Status:** DONE

### R4 — every operation is by key

Andy: labels serve search and display only. `deviceIdentity` resolves a
token as a key (the owner by key, else one keyed read), never by label. A
sender or target named by label is refused.

**Verify:** `spirit/test/diskClient.js` — label as sender 403, as target
404; `spirit/test/devicePeers.js`, `spirit/test/deviceEnrol.js` rewritten to
keys.

**Status:** DONE

### R5 — invites over the store

`invites.js` keeps its API and reads and writes the `invites` table. The
consumedAt handling (D4) is gone with the JSON reader. `hub.js`'s unused
require went.

**Verify:** `spirit/test/invites.js`, `spirit/test/inviteRedeem.js`,
`spirit/test/inviteLock.js`

**Status:** DONE

### R6 — no roster; the relay broadcasts, the node filters

This is compliance, not a choice. Under 0012 widened, no member list is
served, whether by request or by broadcast, and 0013 says a roster passes
the payload limit at about 190 members.

- `streamRoster` is deleted, and the `roster` word has left 0010's register.
- The node seeds its own presence and the relay's from the pinned relay key
  (`presenceNode` `seedRelay`). It keeps a broadcast only for a key it holds
  as a contact (`knows`), and ignores a roster from an old relay.
- `peer.post` to a target no relay reports present goes through the first
  connected relay, and the relay answers (0006: 503).

Consequence, stated: a node no longer sees a contact as red (absent) until
that contact's presence changes. A contact that is merely away reads as
not known.

**Verify:** `spirit/test/presenceStream.js`, `spirit/test/presenceNode.js`,
`spirit/test/presenceWire.js`, `spirit/test/protocolSurface.js`

**Status:** DONE

### R7 — a read-only dump over SSH

`node js/relayDump.js` prints counts; `key <k>` prints one row and its
partnership; `label <l>` prints its holders, at most 10. It never prints the
whole roll. It uses a read-only connection (`relayStore.openReadOnly`): no
schema, no import, a write throws, and it is safe beside a running relay.

**Verify:** `spirit/test/relayStore.js` — *relayDump* section.

**Status:** DONE

### R8 — the relay refuses to start without its store

`relayServer.js` exits, saying why, if `node:sqlite` cannot load (floor Node
22.13) or the store cannot be opened (R2's unreadable file). It opens the
store at start rather than on the first request, and closes it on SIGTERM.
The node never loads `relayStore.js`. The distinct exit code and the unit's
`RestartPreventExitStatus` are Part B's (B4), for every startup refusal at
once.

**Verify:** `spirit/test/storeImport.js` — the open refuses. The process
exit itself has no spawned test; it is three lines around that call.

**Status:** DONE

### R9 — the member who answers learns the route back

> **Andy (2026-09-19):** *"Now, because it should've been in the Part A
> cycle."*

Added after Part A's first commit. When B carries a post from N1 in through
partner A, it keeps N1 and A's relay key in memory while the request is in
flight, in the router entry's `carry` (below; this said the `forwarding` map
until that map was removed). When N2's signed reply is taken and B answers it with
a 200, B sends **N2 alone** `('route', { key: N1, at: A })`. It is the same
event cycle 2 broadcasts from A. The node already applies it through
`onRoute` → `learnRoute`, which keeps it only for a contact. There is no
route cache, nothing reaches disc, and B never reads the reply. An oversized
reply, refused with 413, sends no route. Before this, B knew A's key at the
moment it carried the post and dropped it
([NODE-AND-RELAY §9b](../principles/NODE-AND-RELAY.md), "The member who
answers learns the route back").

Not in this requirement: `seen` and ordering hints by it (decided by Andy,
§9b). They change the contacts schema, which Grok sees at the batch review.

**Everything a request holds expires with it.** Andy's ruling: RAM
conservation takes priority, and route caching goes to the route users.
Tracing what R9 adds found a leak that predates this cycle. The `forwarding`
map beside the router was emptied only by a reply, so a forward whose member
never answered stayed in RAM for good, while its comment said the router's
ttl swept it. The partner's answer and the route back now ride in the
router's own entry (`router.open(…, carry)`) and expire with it. The map is
gone. A's `carrying` was traced and does not leak: `askPartner` always
settles within peerPost's wait, and both outcomes delete the entry.

**Verify:** `spirit/test/hintWire.js` — over real sockets, bertrand on B
hears `{ key: alice, at: A's relay key }` after answering, and bella on B
hears nothing; `spirit/test/router.js` — the carry comes back with the
answer, and an unanswered request's carry is freed at expiry, asked of the
garbage collector.

**Status:** DONE

### R10 — a search goes to live partners only

> **Andy (2026-09-19):** *"… peer acquisition for nodes requires liveness of
> the partners; this would accelerate search significantly."* — *"Search
> vs. census is already a loss in completeness."* — built in cycle 3 at his
> word ("yes, c3").

A member's search is propagated only to partners holding their stream here
now (`presentNow.isPresent(relayKey)`, the test hint routing uses). Before
this it asked every `partnered` row and waited on all of them, so one
partner that was down held every search for the full timeout. With none
live, the relay answers from its own members and asks nobody.

**Found while building it, a bug from before this cycle:** `streamClose`
resolved members and the owner only, while `streamOpen` also admits
partners. So a partner whose socket died could never be closed and stayed
present for good, and hint routing treated it as live. `streamClose` now
resolves the same identities `streamOpen` admits.

The fan-out's own budget tier (NODE-AND-RELAY §10) is decided but not built.
It belongs to the Governor cycle, where its numbers are measured.

**Verify:** `spirit/test/liveFanOut.js` — the live partner is asked and the
one that is down is not; a partner whose stream closes is no longer live;
with none live, nobody is asked.

**Status:** DONE

## Part B — the owner's first-claim token

Planned: UNCLAIMED/CLAIMED replaces open mode and `pending-owner.json`
(amending 0003 to *first invited claim is owner*); `install.js`; fixtures mint
the owner invite in-process; B4, a relay with members and no `allow.json`
refuses to start, with the exit code, the unit setting, and `bash/restart` /
`bash/update` reporting it. Requirements are written here when it is built.

## Seams left (rule 6)

- `partners.status` holds only `partnered`. `injected`, `requested`, the
  minting cycle and the partner verbs are cycle 5's.
- The active-row cache is bounded by the connection allowance and has no
  lever of its own; cycle 4's monitor can draw it.
- Search walks the whole roll, a page at a time. That is RAM-flat and
  non-blocking, but not disc-flat. An indexed prefix search is optimization,
  and is not needed here. Measured: about 5.5 µs per member (100,000 in about
  550 ms of work, now spread over turns). It feeds the timeout floor
  (NODE-AND-RELAY §10).
