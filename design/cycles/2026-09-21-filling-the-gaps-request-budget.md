# Filling the gaps — what the request-budget design left unbuilt

**Plan, 2026-09-21. Nothing here is built. Measured against `bfd5df0`.**

> **Andy:** *"i want a plan to fill the gaps."*

Two days of design ([REQUEST-BUDGET.md](../relay/REQUEST-BUDGET.md),
[0016](../decisions/0016-a-relays-capacity-is-its-membership.md),
[0007](../decisions/0007-a-relay-survives-and-earns-its-keep.md)) produced
five product files of code and a great deal that is argued and unwritten.
This says what is left, in the order the dependencies allow, and marks
which parts are Claude's to build and which are not.

**The harness stands at 107 suites, 2534 green, 0 red.** Every stage below
ends there or it does not end.

---

## What is already in code

| | where |
|---|---|
| three requester budgets — member / relay / partner | `router.js`, `relay.js` |
| per-target cap, and a `busy` refusal carrying `retryAfterMs` | `router.js`, `relayServer.js`, `relayConfig.js` |
| the node's post scheduler — one in flight per relay, ordering, classes, split backoff | `postQueue.js`, `peerPost.js` |
| the owner's grant over `settable`, revoked, with two census guards | `governor.js`, `settableCensus.js` |

**What that proves and what it does not.** The **cap** is proven: one
request in flight per relay, on by default, across 107 suites, nothing
broken. The **queue behind it is largely unexercised**, because patience
defaults to zero — one attempt, exactly as before. Retrying is built and
inert.

---

## Stage A — node-side, no wire, no decision

**Claude's, and startable now.** Nothing here touches a packet.

### R1 — a route becomes `{ via, at, seen }`

> **Andy:** *"a node can be a member of multiple relays, if it only
> remembers B of the route, it won't know which relay to post a request
> through."*

`learnRoute(rootDir, publicKey, relayKey)` records the far relay key and
throws away two things it is holding:

- **`via`** — the relay that announced it. `server.js:1109`'s
  `onRoute(url, body)` HAS it and passes it no further. Without it a node
  on three relays guesses which door to use, and at a ceiling of one a
  wrong guess spends the member's only slot.
- **`seen`** — when it last worked. `normalizeRoutes` keeps 8, newest
  first **by position**, so nothing distinguishes a route proven a minute
  ago from one proven in March. A stale route leaves only by being
  displaced, and four ride out as hints on every post meanwhile.

**Both are free at the point where one line currently discards them.**

Shape change to a persisted file, so: existing bare-key rows stay valid as
*"some relay of mine proved this once"* and are simply less useful than
new ones — degrades rather than breaks.

**Status:** OPEN — not built. Node-side and unblocked — the first thing to build.

### R23 — a sibling is a route too, and both ends are told

> **Andy:** *"when a request is made via relay to a node that is a sibling
> on the same relay, the route must be streamed back to the node as well,
> then stashed in contacts exactly the same as if the post target was on a
> foreign node."* — *"because the node doesn't KNOW it is a sibling."* —
> *"this must be done for requestor and replier."*

Route announcements fired **only** on the partner path (`relay.js`,
`announceRoute` and the tunnel branch of `routeReply`, both inside
`carried`). A post delivered to a member of the same relay announced
nothing, so a contact on your own relay got no route stashed at all.

**The objection that looks right and is not.** It appears a node already
knows which relay carried a local post, since it chose one. It does not:
when no relay of its own names that key, `hub.handlePost` posts through
whichever relay it is connected to and sends the contact's hints, and the
RELAY decides where the packet goes — delivered here, or forwarded to a
partner. Only the second was announced, so where a peer lives could be
learned only by **inferring from a silence**.

**Both ends, for the same reason and a stronger one.** The asker learns
where the target lives; the target learns where the asker lives, which is
what it needs to reach back without a search. The target never chose
anything at all — a request simply arrived. The partner path already told
the replier (`{ key: carried.from }`), so this is the local half of a rule
that was only ever half applied.

**Safe to send to anybody**, because the node decides what to keep:
`learnRoute` matches an existing contact row and never creates one, so a
route about a stranger costs one lookup and is gone.

**Verify:** `spirit/test/routerPost.js` — after a local ping and ack, the
asker is told the target is at this relay's key, and the target is told
the same about the asker.

**Status:** DONE

### R24 — a search answer is kept until somebody acts on it

> **Andy:** *"in a search request, it is the node who already knows the
> via field at request time."* — *"so all search returns could be cached
> outside of contacts, and wait until they become applicable."* — *"I'm
> trying to go diligently through all instances where knowledge is thrown
> away blindly, and it costs the relay nothing."*

**A search answer says where every person in it lives, and the node threw
that away.** `hub.handleSearch` built `byKey[p.relayKey] = p.url` to
resolve a partner's address, kept the URL and **dropped the key** — so a
contact acquired from a search arrived with an address in `relays` and
**nothing in `routes`**, and the first post to them carried no hint.

Both halves were in hand at the moment of the answer: the node knows
which relay it asked (and has its key pinned), and the row says whether it
came from that relay or from a partner of it.

**Kept outside the contact book, deliberately.** A search result is not a
contact, and the book's one rule says so: `learnRoute` matches an existing
row and never creates one — *"a relay may improve what this node knows
about its own contacts and may never add to them"*. Writing forty
strangers into it because somebody typed three letters would make a search
a way to fill another person's address book.

So `seenPeers.js` holds them instead: bounded by **age and by space**,
because neither does the other's job (`0016`'s argument in a smaller
place). It becomes applicable at `peer.acquire`, **after** the row exists
— no search result becomes a route until a person has decided to keep the
person.

**What it removes from the plan:** threading a key through the Add button
and back. The node caches what it learned itself, so the app is not on the
path at all.

**Verify:** `spirit/test/seenPeers.js` — a row noted is a row returned; a
miss is null rather than an empty shape; a row that teaches nothing is
refused; stale and overflowing rows go, oldest first; and forty strangers
cost a bound rather than a book.

**Status:** DONE

### R2 — the sweep that needed prioritising, deleted instead

> **Andy:** *"Names are cheaper as by-product of search, Description can
> be deliberate (contact-app-retrofit). when a result-row is clicked a
> description bubble opens below it. ....... My diagnosis: We found a UI
> that spawns an accumulation in the queue, we fix there..... correct? we
> don't run and muddle with the core where it's unnecessary."*

**This requirement asked for `{ kind: 'background' }` to be threaded
through `api.peerPost` so `contactsAskEveryone` could mark itself and
yield to a person's own actions.** It had one caller, and the caller
should not exist.

`contactsAskEveryone` asked every row of a search result for its card —
one request each, on every search, cache cleared first so the same people
were asked again. What it fetched was a **name the row already carried**
(`publicLabel` travels with the search answer) and a **description
almost nobody reads**.

**The app already argued this, for the label, on 2026-09-18**, three lines
below the sweep: *"the relay already said it, right here, when it answered
the search. Asking again is the node spending its own request budget on
something it was told."*

**And the design it reverses had its own reason, which the budget
overturned.** The row was a control until the sweep replaced it —
*"THE ROW IS NOT A CONTROL ANY MORE... every row answers for itself now,
so there is nothing to press"*. True, and it cost a packet per row per
search to be true. At one request in flight per member (`0016`) a
screenful of speculative packets is a screenful of somebody's own turns,
spent before they have asked for anything.

**Why the description is worth fetching at all, which is also why it can
wait:**

> **Andy:** *"the description only gets relevant when the user doesn't
> know if it's 'Tom Smith' he looks for, or 'Tom A. Smith'."*

Disambiguation — and the row already detects it (`alike`, marking a name
worn by more than one answer). The moment a person needs it is the moment
they press.

**So R2 closes by deletion rather than by plumbing.** The scheduler keeps
its class distinction, proven in `spirit/test/postQueue.js` and **now with
no caller**, which is a better resting place than wired through the app
boundary to manage traffic that should not exist.

**Verify:** `spirit/test/contacts.js` — a search asks nobody; a press asks
that person and nobody else; a second press on the same row spends no
second request; what they said appears under their name once pressed.

**Status:** DONE

### R3 — queue depth, and what is shed at the limit

Unbounded today. Harmless at patience zero, a leak the moment patience is
days. **Shed background before deliberate** — shedding oldest would
invert Andy's ordering rule.

> **Andy settled the shape:** *"the node wants to avoid accumulating a
> backlog in the post-scheduler, at this point it has at least the option
> of refusing requests outright until the block is resolved."*
>
> **Refused at the door, never shed from the middle** — dropping from the
> middle would evict work that had already earned its place, which is the
> anti-starvation rule upside down. It is the rule the relay already
> follows on the other box (`router.js`: *"capacity is a refusal, never a
> drop"*).
>
> **Bounded in bytes rather than rows**, because an entry is not what
> costs: a queued request holds its payload until sent, so a row count
> bounds a number nobody cares about. Background yields at a quarter of
> the room rather than at the brim — the class split doing for space what
> it already does for turn.

**Verify:** `spirit/test/postQueue.js` — room is measured in bytes; a
background sweep is refused long before a person's message would be; what
is queued is counted; and the room returns when it goes, so a refusal is
a moment rather than a state.

**Status:** DONE

### R4 — route expiry using `seen`

Falls out of A1: a route not proven in N days stops being sent as a hint.
Distinct from eviction of the contact, which never happens for staleness.

**Status:** OPEN — not built. Depends on R1, which supplies `seen`.

**Stage A ends with:** the scheduler honest about priority and bounded in
size, and a route that is a whole edge rather than half of one.

---


## Stage B — the ceiling drops to 1

**One decision, no wire, and the decision is Andy's.**

### R5 — the timeout is a duration, carried, and diminishing inward

> **Andy:** *"the relay has no business waiting for 15 seconds... your
> concept of diminishing timeouts down the request chain is not
> implemented."* — *"N1 sets a limit on its patience, which gets reduced
> down the chain by the formula you proposed."* — *"part of the request's
> sidecar/envelope."* — *"we start with 5 seconds at the most. the willing
> to wait time in a request is informational, and the next station down
> the chain better hurry."*

**Today the chain is inverted and flat in the middle**, and the numbers
are four rather than two:

| waiter | holds | where |
|---|---|---|
| node's post | 8 s | `peerPost.js:43` `DEFAULT_WAIT_MS` |
| **the relay's note about it** | **20 s** | `router.js:92` `DEFAULT_TTL_MS` |
| relay -> partner hop | 8 s | the same constant, via `partnerRouter` |
| relay's own posts | 15 s | `relay.js:95` `ROUTE_WAIT_MS` |

The inner hop outlives the outer waiter, which orphans a slot for twelve
seconds; and the partner hop waits exactly as long as the node's, so
neither is guaranteed to hear a real answer from the other.

**What is to be built, in five parts:**

1. **A remaining DURATION in the envelope**, beside `hints`/`hintSig` —
   never an absolute deadline, because a timestamp needs two boxes to
   agree about the clock. Same rule as `0011`'s hash.
2. **Each hop grants `min(asked, its own ceiling)`**, so the carried
   number is **informational** and may only ever ask for *less*. A hold
   time a member could lengthen would not be a limit, it would be a
   default.
3. **The ceiling is 5 s, a code constant**, replacing
   `DEFAULT_TTL_MS = 20000` — an unargued number of the kind `0016`
   retired the `256`/`16` pair for.
4. **The router's TTL becomes per-entry.** `sweep()` compares against what
   each entry's requester asked for, not one table-wide number, so a slot
   is held exactly as long as somebody is waiting.
5. **A floor: too little budget earns an immediate refusal**, not a note
   certain to expire — `0006`'s *"deliver or refuse, refuse instantly"*
   applied to time.

**Why this supersedes the cancel-or-align choice this requirement first
described.** Because every hop grants no more than it was asked for,
**every hop finishes before the hop outside it gives up, by
construction** — the inversion becomes unexpressible rather than fixed,
there is no ladder of constants to keep in step, and `cancel` (R10) stops
being a prerequisite for anything.

**Verify:** `spirit/test/budgetChain.js` — the table grants
`min(asked, ceiling)` and expires per entry; a budget below the floor is
refused with `tooLittleTime` and nothing is forwarded; zero is a
declaration and not an absence; a partner is handed 3500 ms of the 4000
this relay was asked for; and the refusal crosses a real socket with its
marker intact.

**Status:** DONE — `DEFAULT_TTL_MS` is 5000 and is now a ceiling rather
than an answer; `budgetMs` rides the post envelope; `relay.js` grants and
passes on `budgetMs - HOP_MARGIN_MS`. R10 (`cancel`) is no longer a
prerequisite for anything, and R7 is unblocked.

### R6 — `maxPerTarget` out of config, into code

Put in `relay-state/config.json` on 2026-09-20 arguing *"only ever written
by a person with a shell"* — the argument revoked hours later. **By the
three-tier rule it is a limit, so it is the code's.** It stays only
because `targetBusy.js` spawns a real relay and has no other way to switch
the cap on; when the constant lands at 1 that suite needs no
configuration at all.

**Verify:** `spirit/test/relayConfig.js` — the parser no longer carries
it; and `spirit/test/targetBusy.js`, which now plants **no configuration
at all** and observes the relay a person would actually run.

**Status:** DONE — `maxPerTarget` is out of `relay-state/config.json` and
is a constant in `router.js`. By the three-tier rule it is a *limit*, and
a limit an owner can widen is not a limit.

### R7 — drop the ceiling to 1 and run the experiment

Setting `DEFAULT_PER_TARGET = 1` on 2026-09-20 produced **10 red beyond
the revocation**: `relayMeter` (4, including *"routePost is unlimited"*
which `0016` already marks for repeal), `routeHints` (3, the partner path
genuinely needing the queue), `router.js` (3, fixtures assuming an
uncapped target). That is the evidence for what B1–B2 have to fix first.

**Done 2026-09-21, and the 10 red became 11, all of them fixtures.** None
was a product failure:

| suite | what it was |
|---|---|
| `router.js` (3) | its own fixtures aiming several requests at one target to test the TABLE's ceiling and the PER-REQUESTER cap — distinct targets now, which is what they always meant |
| `relayMeter.js` (4) | one post at `:109` was never answered while every other post in its flood was. Harmless at sixteen slots; at one it blocked the flood's first post, and the suite then reported *"routePost is unlimited"* — a true statement about a flood that never started |
| `routeHints.js` (3) | `askPartner` returned `new Promise(function () {})` — *"the answer is not under test here"* — so the forwarding route stayed open for its whole ttl. The same line that had this suite wrongly credited as proof of the partner path (corrected in REQUEST-BUDGET on 2026-09-20). It answers now, and sonny answers on the far relay, which is what a member does |
| `budgetChain.js` (1) | mine, two openings at one target |

**The pattern is worth keeping:** every one of them was a fixture asking
the relay for something a NODE would never ask, because a node queues
(R3). They were testing below the layer that absorbs this in production.

**Verify:** `spirit/test/router.js` — unconfigured, a member may be asked
one thing at a time and a second asker is told `busy`; and
`spirit/test/targetBusy.js` over a real socket, with no configuration.

**Status:** DONE

**Stage B ends with:** the ceiling at 1, green, and the sequential
guarantee real rather than argued.

---


## Stage C — the wire

**Not Claude's.** `CLAUDE.md`: a change needing the wire is a team review,
not a patch. Grok reviews in a batch once Andy-initiated design is green,
so this is Andy's to route, not a gate on Stage A.

### R8 — `viaUrl` in a search answer: already built

> **Andy:** *"i want to address those who are 'input' to the cached routes
> in contacts. meaning, we complete the acquisition of cached routes
> before we complain that they are lacking."*

**Checking that instinct found this requirement was never needed. It is
already done, and the claim it rested on was false.**

This said a foreign peer arrives from a search with a relay **key** and no
address, so acquisition could write nothing usable — and concluded
*"nothing in the tree can dial a relay it has not met"*, which was then
carried into `REQUEST-BUDGET.md` and used to block R9, R11 and R14.

`hub.handleSearch` already resolves it:

```js
var needsRoute = Object.keys(found).some(function (k) { return found[k].via; });
…  sendPacket(router, url, relayKey, systemPayload({ partners: true }))
…  if (p && p.relayKey && p.url) byKey[p.relayKey] = p.url;
…  if (at) { row.relay = at; row.relayLabel = labels[at] || ''; }
```

A row that came from a partner carries `via`, the partner's key. The node
then asks the **answering relay** who it partners with — a member-legal
verb the relay answers with `{ url, relayKey, since }` (`relay.js:2500`) —
and rewrites `row.relay` to the partner's URL. The Add button carries that
URL, `peer.acquire` takes it, and `contacts.js:451` appends it to the
contact's `relays`.

**So a foreign contact acquired by search does hold the address of the
relay it lives on**, and has since the row-carries-its-own-label work.

**What the error cost, since it is the second of its kind this cycle.** It
was reasoned from one function — `relay.js:2728` builds a partner's search
answer with `via: p.relayKey` and no URL, which is true — without reading
what the **caller** does with it. The same shape as reading a port list
out of a comment, and as `contactsAskEveryone` being credited to a caller
nobody checked.

**What remains is R9, and it is now the real gap**: the node HOLDS the
URL and still cannot tell its relay where an unknown relay is, because
`HINTS_PER_POST` sends keys. R11's URL rule therefore becomes live with
R9 rather than with this.

**Verify:** `spirit/test/contacts.js` — a row marked `viaPartner` carries
the partner's URL, and acquiring it keeps that URL as a route.

**Status:** DONE

### R9 — hints carry `{ key, url }`

`HINTS_PER_POST` sends relay keys, so even holding a URL a node cannot
**tell** its relay where an unknown relay is. Without this, C1 unblocks
one end and leaves the other blocked.

**Status:** OPEN — not built. Wire, therefore a team review. R8 without it unblocks one end and leaves the other blocked.

### R10 — `cancel`, exposed to a member

Resolves B1 in the direction that keeps the shorter node timeout.

---

**Status:** OPEN — not built, and no longer a prerequisite — R5 makes the inversion it cleans up after structurally impossible. Kept for a caller giving up by choice.

## Stage D — the partner architecture

**Needs C, and needs one rule Andy has not made.**

### R11 — the URL rule, a prerequisite and not a follow-up

`NODE-AND-RELAY.md`'s *"a relay may only ever reach a URL its owner wrote
down"* is broken by the sizing: hundreds of partnerships nobody can
curate. `assertRelayUrl` (`relayRequest.js:42`) was sized against
owner-written URLs and permits **`http://` to loopback on any port** and
**`https://` to any private address**.

Not exploitable today, because every partner URL comes from `setPartner`,
an owner verb. **Live the moment a URL can come from a member**, which is
what C2 enables.

**Status:** OPEN — not decided, and it is Andy's to decide. A prerequisite for R14 rather than a follow-up, since R9 is what makes it exploitable.

### R12 — `last` on a partner row

`relayStore.js:103` has `since` — when the partnership began — and nothing
about when it last worked. That column **orders searches** (replacing
`presentNow.isPresent`, which goes with the streams) and is what makes
D3 possible. It does **not** evict: the roll is the reach.

**Status:** OPEN — not built. Depends on nothing; needed before R13 removes the liveness the streams supplied.

### R13 — no streams between partners

Removes the partner stream pool, the `presence.js:145` contention with
members, most of `partnerLink.js`, and collapses relay↔relay to **one
verb** — the response to a post *is* the reply, which the forward path
already does in production.

**Status:** OPEN — not built. Bones and wire together, so a team review.

### R14 — open partnering, provisional rows, and a visible count

Self-formed partnerships land as `requested` (a status `relayStore.js:24`
already reserves) — evictable freely, where owner-granted rows are not.
Recommended **on** by default, with a count the owner can see, so a relay
that has quietly acquired four hundred partners is a fact somebody
noticed rather than discovered.

---

**Status:** OPEN — not built and not decided. Needs R8, R9, R11 and R12.

### R15 — the per-stream measurement

**Status:** OPEN — not measured. Blocks no stage and is blocked by none; four conclusions rest on it.

## Crossing all of it

**`STREAMS_PER_MB = 16` is a placeholder `governor.js` marks as guessed in
its own comment**, and four conclusions now rest on it:

- what a micro-relay actually costs to run
- whether *"1000 members"* can be put in front of anybody
- whether `connections` can stop being a lever and become
  `ram_available x streams_per_mb`
- how many members a box actually holds

`0016` already calls it *"the highest-value measurement in the project"*.
It needs no stage and blocks no stage, and the apparatus exists — the
Governor reads `heapUsed` every tick.

---

### R16 — the queue survives a restart

Patience *"could be days for a text message"* (Andy), and days means
restarts. The queue is in memory: `postQueue.js` holds `items` in an
array and nothing writes it down, so a node restarted mid-wait forgets
every intent it was holding.

A new persist shape, which `CLAUDE.md` makes a team review rather than a
patch. `relay-state/relay.db` is the precedent for a node-side store a
cycle opened deliberately.

**Two things it must get right**, both of which fall out of R5's rule
that durations are measured on a clock that cannot jump: a persisted
deadline has to convert to wall-clock on the way out and be recomputed on
the way in, and a restart must not reset a backoff a peer had earned.

**Status:** OPEN — not built, and nothing needs it until a caller sets a
patience. `peerPost` defaults to zero, so retrying is inert today.

### R17 — suites clean up the homes they create

Every suite that calls `fs.mkdtempSync` leaves the directory behind.
**160,116 of them were found in `%TEMP%` on 2026-09-20**, and the disc
contention made three consecutive harness runs progressively redder while
each suite passed alone — which reads exactly like a regression and was
not one.

`plantRun.js` shrank each leaked directory from 143 MB to 3.8 MB
(`17c6bc1`) but nothing stopped the leaking: a full run still leaves
roughly two hundred.

**Status:** OPEN — the once-off cleanup ran; the leak itself is untouched.

### R18 — durations are measured on a clock that cannot jump

The scheduler orders by sequence, never by wall-clock, because a burst
shares a millisecond. It must also *measure* on a monotonic clock: an NTP
correction, a suspend or a manual change fires a backoff early, strands
one for the length of the jump, and expires patience on evidence that
never happened.

**Verify:** `spirit/test/postQueue.js` — the default clock is
process-relative rather than epoch, checked by magnitude so a revert
fails here rather than on somebody's laptop after a clock change; and a
backoff measured on the real clock is the length it claims.

**Status:** DONE

### R19 — the load fixture, and seeing it stay lively

The verification this whole cycle was scoped around, and the one thing
from Andy's original framing that has not been done:

> **Andy:** *"i see node request q-ing/scheduling, verification that
> not-available errors causes re-scheduling of the request. and visually
> verifying that natter and contacts still react as lively as before..."*
> — *"if you fire all at once, the queing and scheduling will be put to
> the test."*

Two fixtures, and neither substitutes for the other:

- **one node, wide fan-out, most targets stalling** — proves the node's
  own queue: cap, backoff, head-of-line. Requests **time out**; nothing
  refuses them.
- **two nodes at one target** — proves the *not available* path, emitted
  by the relay rather than simulated. `spirit/test/targetBusy.js` is this
  one, in miniature and over a real socket.

And then the part no suite can do: **looking at it.** Natter and Contacts
reacting as lively as before, with the cards filling in progressively
rather than hanging, which `contacts.js` already renders per card.

**Status:** OPEN — `targetBusy.js` covers the second fixture. The
wide-fan-out fixture does not exist, and nothing has been looked at: the
lab has not been rebuilt since 2026-09-20.

### R20 — the Governor's remaining job

> **Andy:** *"right now it looks like the governor will be unemployed, not
> re-elected..."*

`allowed()` is arithmetic and needs no Governor. `state()`, `levers()` and
`lastDecision()` are reporting and stay. `lever(name)` serves an owner
verb that `0015` stopped and the 2026-09-21 revocation sealed. **`tick()`
is the only governing act left**, and it exists to correct a ceiling that
is wrong only because `STREAMS_PER_MB = 16` is a guess.

So the work is: measure the per-stream cost (R15), then decide whether
what remains is a reporter or a reporter with a safety net — a computed
ceiling assumes per-member cost is stable and heap is not.

**Status:** OPEN — depends on R15. `0017` records the decision and what it
supersedes.

### R21 — labMaster blocks on netstat, and Windows answers a full backlog with RST

**Cause, measured 2026-09-21 after three wrong diagnoses.**

`publicNode()` builds each node's row with `pidsOnPort()` for the pid and
`portHasListener()` for `running` — and `portHasListener` calls
`pidsOnPort` again. Each of those runs a **synchronous** `netstat -ano`,
measured at **66-100 ms idle on Windows**. Two subprocesses per node,
inside a response: six nodes is twelve, and the better part of a second
with labMaster's event loop stopped dead.

While it is blocked labMaster accepts nothing, its listen backlog fills,
and **Windows answers a connection on a full backlog with RST where Linux
queues it.** So `labLifecycle` failed as
`start relay: 0 fetch failed (ECONNRESET)`.

Every observation fits, including the ones that defeated the earlier
guesses: Windows-only (WSL queues rather than resets), load-dependent
(netstat is slower and labMaster busier under the full harness), and
**never reproducible on the lab suites alone** — twenty consecutive runs
of just those eight suites stayed green, because five clients do not load
the box the way a hundred and nine do.

**Three wrong diagnoses before it, each recorded here as it was made:**

1. **A port collision** — read out of a COMMENT that documents port
   ownership. `labLifecycle` binds two ports and nothing else.
2. **labMaster contention** — falsified by those twenty narrow runs.
3. **ECONNREFUSED** — a guess from an error reported as node's generic
   `fetch failed`, which named no code. A fix was aimed at a cause the
   evidence never established, and R21 was marked DONE on it.

**What actually moved it forward was making the failure name itself.**
One line adding the cause code to the message; the next reproduction said
`ECONNRESET` and the guessing stopped.

**Fixed:** `portScanText()`, a 400 ms cache of the raw scan. One
subprocess per burst instead of two per node, identical answers, and far
too short to hold a stale one across a person's click. The retry in
`ensureMaster.js` stays for what it genuinely is — a refused connect while
labMaster restarts is safe to retry — with its comment corrected to say
it was never the cause of this.

**Verify:** `spirit/test/harnessRetry.js` pins the retry predicate, which
is the safety-critical half (`POST /api/nodes` is not idempotent, so a
request that may have ARRIVED must never be sent twice).

**The race itself is measured, not tested:** reproduced at iteration **3**
of a full-harness loop before the fix; **10 consecutive clean full runs**
after it, on Windows, the platform that fails. At the observed rate that
is about a 1.7% coincidence — and unlike the previous close, the mechanism
is named and measured rather than inferred.

**Status:** DONE

### R22 — censusNarrow reads a file another suite deletes

Found in the WSL checkout, 2026-09-21, once in three runs.
`censusNarrow.js` walks `spirit/run` and then reads every file it found.
`buildStamp.js` writes `spirit/run/zz-copy-probe.js`, checks it is named
as uncopied, and unlinks it in a `finally` (`buildStamp.js:118-130`). Land
the walk before that write and the read after that unlink, and the read
throws `ENOENT` and takes **the whole suite** with it — eight checks lost
to a file that was never anybody's code.

Neither suite is wrong: the probe has to be under `spirit/run` to test
anything, and the census has to read what is there. They are wrong
together, because six suites share one working tree.

**Fixed:** `codeOf` treats a vanished file as empty. Skipping cannot hide
an offender — a file that no longer exists is not calling anything.

**THIRD TIME THIS SHAPE HAS APPEARED IN ONE CYCLE**, which is the part
worth keeping: `labMaster`'s `copyTrackedSpirit` reads an index that lists
deleted files, `plantRun.js` copies a listing that can go stale mid-copy,
and now this. **Anything that walks and then reads must tolerate the walk
being out of date.**

**Verify:** `spirit/test/censusNarrow.js` — the read tolerates ENOENT, so
the suite survives a file appearing and vanishing beneath it.

**Status:** DONE

## The order, and why

```
A  (node-side)        startable now, no decisions
B  (ceiling to 1)     needs B1 ruled: cancel, or align the timeouts
C  (wire)             team review; unblocks D entirely
D  (partners)         needs C, and needs D1 ruled before it ships
```

**A does not wait for anything.** B waits on one ruling. C is a review. D
waits on C and on the URL rule.

**Nothing is deliberately left out any more.** Persistence was prose in
the first draft of this plan and is now R16, because a gap described in a
paragraph is a gap that can be forgotten and a requirement is a count the
harness keeps asking about.
