# Filling the gaps — what the request-budget design left unbuilt

**Plan, 2026-09-21. Measured against `bfd5df0`.**

~~*Nothing here is built.*~~ — struck 2026-09-21. Twelve of the twenty-six
are DONE; the status on each requirement is the current answer.

**The argument behind R23–R26 is not here.** It is
[WHAT-A-NODE-KNOWS.md](../relay/WHAT-A-NODE-KNOWS.md) — one rule, what was
being discarded, and what is decided, recommended and open — the way
[REQUEST-BUDGET.md](../relay/REQUEST-BUDGET.md) holds the argument behind
R1–R22. This file holds the work.

> **Andy:** *"i want a plan to fill the gaps."*

Two days of design ([REQUEST-BUDGET.md](../relay/REQUEST-BUDGET.md),
[0016](../decisions/0016-a-relays-capacity-is-its-membership.md),
[0007](../decisions/0007-a-relay-survives-and-earns-its-keep.md)) produced
five product files of code and a great deal that is argued and unwritten.
This says what is left, in the order the dependencies allow, and marks
which parts are Claude's to build and which are not.

**The harness stands at 110 suites, 2610 green, 0 red** (`7806b3d`; it was
107 / 2534 when this was written). Every stage below ends there or it does
not end.

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

## The running list

> **Andy:** *"when i actually had the R1-Rxx list in front of me, i was
> able to order them to suit my perception. I knew: 'I'm not gonna run to
> papa grok until the job (cleaning up core design, and proving it) is
> done.' so a running R-list is very valuable to me."*

**This table is the list, and it is maintained, not written once.** The
stages below are the dependency order; **the order of work is Andy's**, and
the two are not the same thing. What a stage can tell you is only what a
requirement is *blocked by* — the last column. Anything with a blank there
can start today.

**Open is nineteen. Eight of those are blocked by nothing, and four
of the nineteen are decided and waiting only to be built.**

| | what | status | solution? | blocked by |
|---|---|---|---|---|
| **R1** | `via` on the shadow row; `routes` off the contact row | OPEN — half can start now | **yes** | `routes` half: **R26** |
| <sub>R2</sub> | <sub>*the sweep that needed prioritising, deleted instead*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R3</sub> | <sub>*queue depth, and what is shed at the limit*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| **R4** | route expiry — two evictions: cache-limit and last seen | OPEN — mechanism decided, number open | **yes** | R1; number with R26 |
| <sub>R5</sub> | <sub>*the timeout is a duration, carried, diminishing inward*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R6</sub> | <sub>*`maxPerTarget` out of config, into code*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R7</sub> | <sub>*drop the ceiling to 1 and run the experiment*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R8</sub> | <sub>*`viaUrl` in a search answer — was already built*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| **R9** | hints carry `{ key, url }` | OPEN — **wire, team review** | **yes** | |
| **R10** | `cancel`, exposed to a member | OPEN — no longer a prerequisite | **yes** | |
| **R11** | the URL rule / SSRF — a provenance rule, not a URL rule | OPEN — **Andy's to decide**; three candidates written up | partial | |
| **R12** | `last` on a partner row | OPEN | **yes** | |
| **R13** | no streams between partners | OPEN — **wire, team review** | **yes** | R12 |
| **R14** | open partnering, provisional rows, a visible count | OPEN — not decided | **no** | R8, R9, R11, R12 |
| **R15** | the per-stream measurement | OPEN — **four conclusions rest on it** | **no** | |
| **R16** | the queue survives a restart | OPEN | partial | R26's store |
| **R17** | suites clean up the homes they create | OPEN — leak untouched | **yes** | |
| <sub>R18</sub> | <sub>*durations on a clock that cannot jump*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| **R19** | the load fixture, and *seeing* it stay lively | OPEN — half covered | **yes** | |
| **R20** | the Governor's remaining job | OPEN | **no** | R15 |
| <sub>R21</sub> | <sub>*labMaster blocks on netstat; Windows RSTs a full backlog*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R22</sub> | <sub>*censusNarrow reads a file another suite deletes*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R23</sub> | <sub>*a sibling is a route too, and both ends are told*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R24</sub> | <sub>*a search answer is kept until somebody acts on it*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R25</sub> | <sub>*a route is learned at every opportunity; policy does not gate it*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| **R26** | the shadow needs a store, and it is a persist shape | OPEN — **new persist shape, team review** | partial | |
| **R27** | a presence event about a stranger is discarded, and it is a route | OPEN | **yes** | |
| **R28** | a label change reaches everybody, at every level | OPEN — **decided `0019`**; hop 1 already built, hops 2-3 **wire, team review** | **yes** | |
| **R29** | the shadow row carries rank and provenance | OPEN | **yes** | R1, R26 |
| **R30** | presence is last-known, and the shadow dates it | OPEN — **decided `0019`** | **yes** | R29 |
| **R31** | the owner caps the cache in disc space, called “maximum cache size” | OPEN — **decided**; default 16 MB recommended | **yes** | R26 |

**Done rows are greyed.** Markdown has no colour, so they are set small
and italic and lose their bold — present, in number order where you would
look for them, and visually out of the way. Say the word if you would
rather they collapsed out of sight entirely.

**What "solution?" means.** Not *is it decided* and not *is it started* —
**is there a worked answer somebody could build from without re-deriving
it.** A DONE row is a dash; it has been built, so the question is spent.

### Which first step clears the most

> **Andy:** *"so we can decide which first step contributes most to
> clearing the R-list."*

Reading the blocked-by column backwards gives what each row **unblocks**:

| build this | frees, directly | and then |
|---|---|---|
| **R26** the store | R1's second half, R16, R29, R31 | R29 frees R30, R1 frees R4 — **six in total** |
| **R12** `last` on a partner row | R13, and one of R14's four | |
| **R1** `via` | R4, R29 | R29 frees R30 — three |
| **R15** the measurement | R20 | plus four claims nobody can state until it exists |

**R26 is the keystone, and it is blocked by nothing but a sentence from
Andy.** Its one open question is the node floor: `node:sqlite` needs
**22.13** and `package.json` says **18**. That is not research, it is a
ruling — and until it is made, six rows cannot move.

**R15 is the one this column just exposed.** Four conclusions rest on it,
nothing blocks it, and **it has no body at all** — the requirement is a
heading and a status line. It has been carried for a day as though it were
understood, and what it actually needs is a method: what to measure, on
what, against what baseline. That is a sitting of its own, not a task.

### A team review is a batch at the end, not a gate in the middle

> **Andy:** *"team review receives consideration when all we can do is
> done."*

**So "wire, team review" is not a reason a row waits.** It is a note about
which pile the row is in. There are two:

- **Build it** — everything that changes no packet.
- **Bring it to the review** — everything that does, convened **once**,
  when the first pile is empty.

**This does not loosen `CLAUDE.md`**, which says to stop rather than patch
`relay.js` so a UI works. The two agree and answer different questions:
that rule says *do not build it alone*, this one says *do not stop for it
either* — keep going on what does not need it, and let the review
consider the accumulated set.

**Build now, nothing in the way:** **R27** (one line, node-side), R17, R12,
R19, R15, R1's `via` half — and, once R26's floor is ruled, R29, R30, R31
and R1's second half.

**For the review, when that list is empty:** R9, R13, R28's hops 2 and 3,
and R26's persist shape. Four rows, one sitting.

**The three that gate the most:** **R15** (R20, and four claims nobody can
make until it is measured), **R26** (R1's second half, R16, and `0018`
finishing), **R11** (R14).

**This is the cycle, not the project.** Nothing goes to Grok on account of
a row here; the cycle is accepted when the list is closed, which is
`0017`'s rule and Andy's *"I'm not gonna run to papa grok until the job is
done."*

---

## Stage A — node-side, no wire, no decision

**Claude's, and startable now.** Nothing here touches a packet.

### R1 — `via` on the shadow row, and `routes` off the contact row

> **Andy:** *"in fact: this design may eliminate the hints from the actual
> contact list..."*

**This asked for a contact row's routes to become `{ via, at, seen }`.
R24 and R25 changed what that means: the shadow
(`seenPeers.js`) already holds `at` and `seen`, for contacts and
non-contacts alike, so most of this requirement is built somewhere else.**

What is left is smaller and splits in two:

**One — `via` is still discarded.** `server.js:1109`'s `onRoute(url, body)`
has the relay that announced it and passes it no further, so a node on
three relays still cannot tell which of its own doors proved a route. The
shadow row is where it belongs now, beside `at` and `seen`. Node-side,
unblocked, small.

**Two — the contact row stops holding routes at all.** DECIDED
([0018](../decisions/0018-the-route-cache-belongs-to-the-machine.md)),
and it lands with R26.

> **Andy:** *"the hints are removed from the users contacts. (let's admit
> it: they [are] not human-readable, in reality)"*

A contact row's `routes` are base64 relay keys, eight of them. Nobody has
ever read one — machine data in a readable file, claiming a rule it never
satisfied.

The shadow is a **superset**: every route a contact row could hold, plus
the ones for people who are not contacts. So `routes` on a contact row is
a second copy that can disagree with the first, and it is machine state
living in the one file that is meant to be *"the digitisation of its
owner's spirit"* — which
[NODE-AND-RELAY](../principles/NODE-AND-RELAY.md) now says explicitly is
not what a node's readability rule is for.

It would also make Andy's own rule automatic rather than enforced: *"a
shadow route must not be dropped when a contact is deleted"* is a fact
about where routes live, once they only live in one place.

**Blocked on R26, and not before.** Contacts persist in a file; the shadow
is in RAM. Removing `routes` from the book today would mean every route
dies at restart — exactly the direction this whole thread is running
against.

**Status:** OPEN — `via` on the shadow row can be done now; the
elimination waits on the store.

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

> **Andy:** *"route expiry has two evictions: cache-limit, and last
> seen."*

**Two evictions, and they are the two this design already has.** R4 is not
a third bound — it is the age half of the pair, named from the route's side
instead of the cache's:

| eviction | the bound | where it is decided |
|---|---|---|
| **cache-limit** | space | **R31** — the owner's disc cap, replacing `MAX_ENTRIES = 500` |
| **last seen** | age | here, using the row's `seen` |

That is 0016's argument arriving for the third time: *"a space bound leaves
a cache frozen while there is room, and an age bound leaves it unbounded
while there is not."* Neither does the other's job, and naming them
together is what stops a later session adding a third.

~~*Falls out of A1: a route not proven in N days stops being sent as a hint.
Distinct from eviction of the contact, which never happens for
staleness.*~~ — **struck.** It described a **third** state, a row that
lives but whose route is withheld, which under the two-eviction rule does
not exist: a row is here or it is gone, and while it is here its route is
offered. Simpler, and one fewer thing to get wrong. The contact half of
that sentence is right and unaffected — a contact is never evicted for
staleness, and 0018 moves its routes out entirely.

**What is left open is the number, not the mechanism.** `MAX_AGE_MS` is an
hour (`seenPeers.js:93`), and `seenPeers.js:44` already says why that is
not a decision: it is what the cache can afford while it lives in RAM and
loses everything at restart. Against *"the user may forget all search
results, the node must not"*, an hour is short. **The number belongs with
R26**, because a store is what makes a long one affordable.

**One consequence, stated rather than argued.** An eviction on age takes
the whole row, so the label and the last-known presence go with the route.
That is right — a name with no route is cheap but not free, and unbounded
label-only rows would be a third lifetime to reason about. The cost is one
search to learn the name again.

**Status:** OPEN — mechanism decided, number open. Depends on R1 (which
supplies `via`/`seen` on the row) and shares its space half with R31.

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

### What the two holes actually are

`assertRelayUrl` (`relayRequest.js:42`) is nine lines and permits:

| | permitted | what that reaches |
|---|---|---|
| `https:` | **any host at all** | `https://10.0.0.5`, `https://192.168.1.1`, and any DNS name that **resolves** to one — anything inside the box's network that speaks TLS |
| `http:` | loopback, **any port** | every plain-HTTP service on the relay's own machine: admin panels, local databases, another process's API |

**Neither is a bug.** The function was sized for URLs an owner typed, and
for owner-typed URLs it is right — the loopback exception is what the whole
lab runs on (`http://127.0.0.1:<port>`, every suite).

**SSRF is what it becomes when somebody else supplies the URL.** The relay
stops being the thing making a request and becomes the thing *making a
request on a stranger's behalf*, from inside the network, past whatever
firewall exists. The classic prize is a cloud metadata endpoint; the
ordinary one is everything else on the same box.

### Why it is not live, and exactly what makes it live

**Every URL dialled today was written by an owner.** `setPartner` is an
owner verb; `hub.js:1423`'s `body.url` arrives from the node owner's own
browser; the rest come from `relays.json`. Checked, not assumed.

**Two things make it live, and they are both on this list:**

- **R9** — hints carry `{ key, url }`, so a **peer** supplies a URL.
- **R14** — open partnering, so a **stranger relay** supplies its own.

That is why this is a prerequisite and not a follow-up: it must be settled
**before** either lands, or they land with the hole in them.

### The shape of the answer, which is not a URL rule

**The function has no opinion about who is calling** — its own header says
so: *"a free function over a URL and a path, with no state, no identity and
no opinion about who is calling."* **That is the thing to change.** The same
URL is fine from one source and not from another, so the rule is about
**provenance**, not syntax:

| source | rule |
|---|---|
| the owner wrote it | today's rule, unchanged — loopback stays, the lab keeps working |
| a peer or a stranger relay sent it | **public only** |

Three candidates for *"public only"*, for Andy to pick between:

1. **Refuse private space.** Resolve the name first, refuse loopback,
   link-local and RFC1918, and **connect to the resolved address** rather
   than re-resolving — otherwise a name that answers twice defeats it.
   Most correct, most moving parts.
2. **Public DNS names only, no IP literals.** Simple to state and to read
   in a refusal; beaten by a name that resolves inward, unless paired with
   1.
3. **Owner allow-list, still.** What `NODE-AND-RELAY.md` says today. The
   sizing already killed it — hundreds of partnerships nobody can curate —
   and it is listed so the decision records that it was considered.

**Status:** OPEN — **not decided, and it is Andy's to decide.** The holes
and the shape are written up here; what is missing is a ruling, not
research. A prerequisite for R9 and R14 rather than a follow-up.

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

### R25 — a route is learned at every opportunity, and policy does not gate it

> **Andy:** *"the node must implicitly learn routes at EVERY
> opportunity."* — *"1) passive, the node is informed of a new peer, and
> has a policy that decides about acquisition. this should not govern the
> node's global-cache-updates. 2) active acquisition: via search. again,
> the user may forget all search results, the node must not."* — *"Any
> peer a node could possibly connect to, the route to it can be known to
> the node."*

**R24 fed the cache from searches only. Four other places knew a route and
threw it away.**

| where | what it had | what it did |
|---|---|---|
| a packet arriving (`peerPost.onRequest`) | the sender's key and the relay it came through | nothing unless the door said admit or hold |
| the auto-add (`hub.remember`) | the road, in `relays` as a URL | wrote no route key at all |
| a route announcement (`server.js onRoute`) | key and far relay | dropped it if the peer was not already a contact |
| an invite or pasted key (`peer.acquire`) | the relay URL the caller named | consulted the cache and stopped |

**The first is the one Andy's point is about.** `remember` runs for admit
and hold and not for drop, so a node that declined to talk to somebody
also forgot where they were. **Policy belongs to the address book; the
cache is a record of what this node was told.** The route is now noted at
arrival, after the packet verifies and before any verdict.

**The third matters more since R23**, which made a relay announce to BOTH
ends: a node answering a stranger learned where they live and discarded it
in the same breath.

**The fourth is what made the invariant false.** An invite or a pasted key
has no search behind it and nobody writing in — and the caller names a
relay whose key this node pinned when it accepted it. One lookup, thrown
out, producing a contact nobody could route to.

**What the cache is, which decides what may be done with it:**

> **Andy:** *"key the global cache by peer ID (it becomes a
> shadow-contact-list)"* — *"and implicitly a duplicate of the relays
> member-roll"* — *"(time-lagged, of course)"* — *"it is simply not
> canonical."*

Keyed by peer, so growth is bounded by distinct people rather than by
traffic. It may **guess** — a wrong hint costs one failed attempt — and
may never **assert**: not a roster, not a count, not a membership check.
And it stays inside the node: the rules against duplicating a roll
(`0012`, `PARTNERS.md`) are about a relay holding another relay's people,
which this is not, but the distance is one accessor wide.

**Verify:** `spirit/test/routeStash.js` — a stranger who writes is added
with the road they came in on; a route a search already found is preferred
over the road one packet took; and a key pasted with a relay leaves a
route from the key this node pinned for it.

**Status:** DONE

**Open, and one constant:** `MAX_AGE_MS` is an hour, which fits a search
somebody is still looking at and does not fit *"the user may forget all
search results, the node must not"*. Entries are ~150 bytes and keyed by
peer, so the count bounds it cheaply; the age bound is the one that
argues with the requirement.

### R26 — the shadow needs a store, and it is a persist shape

> **Andy:** *"a shadow route must not be dropped when a contact is
> deleted."* — *"and it must be kept up-to-date, and because it is a
> shadow may have to be stored in an indexed database."*

**Two halves. The first is built; the second is not mine to build.**

**Kept up to date** — `note()` overwrites, and the cache is now fed from
every source a route can arrive by, so the newest answer wins. One honest
gap: **a hint that fails does not un-learn.** A peer who moves relays
leaves a stale row until something newer overwrites it or it ages out. A
wrong hint costs one attempt, so this is cheap to live with, but "up to
date" is best-effort rather than guaranteed.

**Survives a deleted contact** — nothing in `run/` clears it, and
`contactBook.forget` already says why in its own words: it *"forgets YOUR
side of a relationship, and a relay's census is not yours to edit."*
Re-adding somebody restores their route without asking anybody.

**The store is the open half.** In memory today, so a restart forgets
everything — which argues with *"the user may forget all search results,
the node must not"*. A node's contacts are a JSON file rewritten whole; a
shadow list keyed by peer would outgrow that shape, which is what
"indexed" is about.

**It is a new persist shape, and `CLAUDE.md` makes that a team review
rather than a patch.** The last time that line moved it was Andy's
decision in cycle 3 (`relay-state/relay.db`, owned by `relayStore.js`).

**Worth deciding with R16, not separately.** Two things now want node-side
persistence — this, and the scheduler queue surviving a restart, which a
patience measured in days requires. One store answers both, and
`node:sqlite` is already a dependency on the relay side.

**What the shape may be, and why it is allowed to be that** —
[0018](../decisions/0018-the-route-cache-belongs-to-the-machine.md),
decided 2026-09-21:

- **It can reach roll size**, a hundred thousand rows. A node's contacts
  are a JSON file rewritten whole, and that shape does not survive four
  more orders of magnitude — which is what "indexed" is about.
- **The route cache belongs to the machine, not the human**, so the
  node's readability rule does not reach it. The test is whose
  information it is, and `server.js` is the exemption that was always
  there without being named.
- **`node:sqlite` keeps the dependency clause intact**, being built into
  node — *"no dependencies outside native node.js"* still holds.
- **And it moves the floor**, which is the cost this requirement cannot
  decide alone: `package.json` says `node >=18`, `node:sqlite` arrived in
  **22.13**, and an indexed store on the node raises every user's
  minimum.

**Status:** OPEN — the store, its floor, and whether `MAX_AGE_MS` (an
hour) survives at all once forgetting is a choice rather than a
consequence of living in RAM.

### R27 — a presence event about a stranger is discarded, and it is a route

> **Andy:** *"we then feed it at every opportunity via relay stream."*

The eighth place knowledge is thrown away, and by volume the largest.
Argued in [SHADOW-PEER-LIST.md](../relay/SHADOW-PEER-LIST.md).

A relay broadcasts `presence {key, present}` to every member on every
arrival and departure (`relay.js:3741`, `:3797`, `:3827`, `:1845`). The
node drops the ones about people it does not already hold:

> `presenceNode.js:181` — `if (knows && !knows(body.key) && byRelay[url][body.key] === undefined) return;`

and with the event goes **the URL it arrived on** — which is the relay
saying, about its own member, where that member lives. Highest authority
there is, free, and arriving for every member of every relay this node is
on. It is also the only route source that requires nobody to act.

**The filter is right and stays.** The presence *picture* is about this
node's contacts and must not fill with strangers. What is wrong is that
the filter returns before anything else gets a look.

**Feed `seenPeers` first, then filter.** The same shape `peerPost` already
uses — `noteSeen` is called on every verified arrival **before** the door
decides (2026-09-21). One line moved, no packet changed.

**Status:** OPEN — not built. Node-side, in-file, depends on nothing.

### R28 — the events that already fire reach one listener

> **Andy, in 0012 as corrected (2026-09-18):** *"A route is established and
> verified — that's a broadcast. **A member is added — broadcast it.**"*

Four events fire today and go to the owner alone: `claim` (`relay.js:1254`),
`peer-renamed` (`:1767`), `peer-removed` (`:1855`) and `partner-added`
(`:803`). `ownerEvent` addresses one sink by construction (`relay.js:3451`).

**`peer-renamed` is the one that matters.** It is the only moment a relay
knows a label changed, it carries exactly the `{key, label}` pair Andy
wants kept fresh, and no member hears it. A node learns a new name only by
running a search later, or by a route announcement that happens to carry
one.

**The arithmetic says these are the cheap ones.** A broadcast costs
`O(members) × event rate`, so the events that earn one are rare, durable,
and unobtainable otherwise. `peer-renamed` and `claim` are all three and
are not broadcast; `presence` is the high-rate one and is broadcast
already. The current code has it backwards.

~~**One part is not Claude's to decide.** Whether `presence` may also carry
a label...~~ — **struck by
[0019](../decisions/0019-a-label-is-broadcast-and-presence-is-last-known.md)**,
at the premise rather than by answering it. Stranger presence is not pushed
at all under R30, so there is no stranger broadcast to hang a label on.

**Decided 2026-09-21, and the scope grew a hop.**

> **Andy:** *"add public Label change to broadcast, at all levels. A user
> changes a public label, it goes to all relays, a relay receives a
> label-change-post, it is broadcast to members."*

**Three hops, and the first one is already built.**

1. ~~*The node fans a rename to every relay it is a member of.*~~ — **done
   before this cycle.** `infoPush` (`info.js:281`) posts to every seat at
   once, on Andy's own instruction in that file's header: *"i want this app
   to distribute my label to ALL relays I'm a member of."* An earlier draft
   of this requirement said the fan-out was missing, read from
   `natterDetails`, which is what the Info app replaced.
2. **The relay broadcasts `{key, label}` to its members**, instead of
   `ownerEvent` to one sink.
3. **`claim` broadcasts too**, which 0012 decided on 2026-09-18 and the
   code never did.

**It stops at the partnership.** A stranger on a partner relay learns the
new name at their next search or exchange — correct, because a relay
speaks for its own members and a partner passing a name on is second-hand
by construction.

**Status:** OPEN — **decided, not built.** Hop 1 is already built. Hops 2
and 3 are new broadcasts on the wire, so a **team review** (`CLAUDE.md`).

### R29 — the shadow row carries rank and provenance

**Rank first, recency second.** The row is
`{ at, url, label, seen }` (`seenPeers.js:101`): one timestamp for
everything, one route, and no record of who said any of it. So a
second-hand search answer relayed by a partner overwrites a rename from the
peer's own relay, and a peer on two relays cannot be held at all.

Proposed in [SHADOW-PEER-LIST.md](../relay/SHADOW-PEER-LIST.md): `label`
with its provenance, `routes` as a capped list carrying `via`, and a rank
ladder — the host that holds the row outranks a signature-proved
announcement, which outranks an arriving packet, which outranks a
second-hand search row.

This is what greed alone cannot do: **refuse a downgrade.** Greedy today
means a worse answer that arrives later wins.

**Status:** OPEN — not built. Needs R1 (`via`) and lands properly with R26
(the store), since provenance per field is the shape an indexed store is
for.

### R30 — presence is last-known, and the shadow dates it

> **Andy:** *"rule: presence is always last-known, and since the
> shadow-roll has updated-time-stamps, the info is true."*
>
> *"shadow-roll track presence in a time-stamped fashion."*

Decided by
[0019](../decisions/0019-a-label-is-broadcast-and-presence-is-last-known.md).
Presence stops being a claim about now and becomes dated evidence: *"present
as of 14:02"* is true for ever.

**The row gains `present`, and nothing else.**

> **Andy:** *"the presence-time-stamp is implicit in the last-updated
> timestamp of the shadow-roll-row."*

So presence is a **value, not a provenance triple** — unlike `label`, which
needs its own rank because sources disagree about a name. The row's own
`seen` dates it, and *"present, as of this row's last update"* is the true
statement the rule asks for. One timestamp for the row is the whole of it.

Not the live presence picture, which stays what it is: the merge of rosters
from relays this node holds a stream to, about this node's own contacts
(`server.js:1062`).

**A stranger's mark comes from three places:**

1. **Returned in a search → green, for every row that came back.**

   > **Andy:** *"the search carries implied presence, which should trigger
   > updates, for all search results. strangers can only be found if they
   > ARE present, this warrants a 'present' on the shadow-roll-row of every
   > search result."*

   Search is online-only, so **being found is the evidence** — nothing has
   to be asserted, the answer's existence is the claim. `hub.js:1868` drops
   anything marked absent and `:1936` marks the rest present, so it is true
   by construction rather than by trust.

   **The write is one field.** Every search row is already noted to the
   shadow at `hub.js:1997`; `present: true` joins that object. *"For all
   search results"* is the load-bearing phrase — not the rows somebody
   clicked, every row that came back, which is R24's rule carrying a
   second field.
2. **Any reply to a post → green**, whatever the reply says. A refusal
   still proves reachability; the content is a separate matter.
3. **`503 peer not reachable` → not green**, and this one is streamed.

> **Andy:** *"requests that fail with 'not-available' also generate a
> streamed update of the shadow-roll."*

**The third is the one that was being wasted.** `relay.js:1579`, `:1996`
and `:3094` already refuse a post with `503 peer not reachable` — the
relay saying, about a peer it holds a row for, that nobody is on the other
end. That is a first-hand presence fact arriving on a path the node already
reads, and today it ends its life as a failed post.

**It costs nothing new.** The refusal is already on the wire and already
addressed to the one node that asked. What changes is that the node writes
it down instead of only reporting it.

**A sibling's presence is live, and the node can now tell.** R23 made
siblings announce to both ends, so a same-relay peer's `at` is a relay key
this node already holds — comparable against its own
(`relayKeys.pinned`, `presenceNode.relaysNaming`). Andy: *"the fact that we
log full routes for same-relay targets also lets the node-machine know if a
target is a sibling, and the presence bit is more responsive."* It could not
know this before; that was the difficulty R23 was opened on. So: a sibling
is refreshed by the relay's own broadcasts as they happen, a foreign peer by
this node's traffic. **This is what makes R27 worth more than one line** —
a sibling stranger's presence is being delivered free and dropped at
`presenceNode.js:181`.

**The obligation, and it is the part that makes the rule honest.**

> **Andy:** *"the gap is that the tooltip doesn't include the time
> stamp."*

**Wherever a mark is shown, its age is available.** The sentences are
rendered on every row already — `contacts.js:346` and `:579`, from
`contactsPresenceTitle` (`:288`) and `contactsSeenMarkTitle` (`:322`) — and
all four are in the present tense, which is the live claim this rule says
presence is not. **Four strings, one field, no new control**, and an
hour-old green stops being the false positive `contacts.js:271` was built
to avoid.

**And `contacts.js:271` is amended when this is built, not before.** *"FALSE
NEGATIVES ONLY"* still stands as written: this changes what makes a mark
honest (an age), not the preference for promising less.

**Open inside this requirement:** which mark NOT-green is. A failed post is
more than white knows and less than red claims, and `0019` deliberately
leaves it.

**Status:** OPEN — decided, not built. Node-side and UI; depends on R29 for
the row shape.

### R31 — the owner caps the cache in disc space, and it is called that

> **Andy:** *"the node owner must be able to cap the shadow-roll by disc
> space: default? the UI for this node-configuration item fits best into
> the info-app right now, and should be presented as maximum cache size,
> not a technical term."*

Argued in [SHADOW-PEER-LIST.md](../relay/SHADOW-PEER-LIST.md).

**A lever, three days after the owner's levers were revoked, and the test
says it is the opposite case.** `settable` went because an owner cannot
know what a stream costs in RAM. Disc on the owner's own machine inverts
it: the code cannot know how much there is or what else wants it, and the
owner knows exactly. **A lever is legitimate when the owner knows something
the code cannot.**

**It replaces `MAX_ENTRIES = 500`** (`seenPeers.js:92`) — a declared,
unmeasured row count in a unit nobody thinks in. **`MAX_AGE_MS` stays**:
0016's *"a space bound leaves a cache frozen while there is room, and an
age bound leaves it unbounded while there is not"* still holds, and this
replaces one of the two.

**Default: 16 MB**, off 0012's measured anchor (*"~154 B/row as JSON"* for
`key + label + present`; a shadow row adds `at`, `via`, `url`, `seen` —
~300 B JSON, ~600 B on disc). That is ~28 000 peers: more than the combined
membership of every relay a person is plausibly on, small enough that
nobody resents it, and still a number that can bind. **No default binds a
normal node** — the cap exists so the failure mode is chosen rather than
discovered.

**The number is node config, and readable.** Not `identity.json`, which is
the public card. 0018's test — *"did the owner acquire it, and would they
care?"* — says the cache is the machine's and exempt while **the cap is
the owner's and is not**.

**On screen: Info, called "Maximum cache size."** Not shadow roll, not
route cache. Draft copy is in the design note. `UI_DESIGN_STYLE` §1 gives
the floor a real number rather than a refusal, and §6 is the general form
of Andy's instruction.

**Status:** OPEN — not built. Needs **R26** (a cache with no store has no
disc footprint to cap). UI and node config; no packet.

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
