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

**Five open, five deferred, one cancelled, twenty-eight done.** Three need
the team review (R9, R13, R28), one is Andy's to decide (R11), and R14
waits on those. **Nothing open can be built without a review or a ruling.**

| | what | status | solution? | blocked by |
|---|---|---|---|---|
| <sub>R1</sub> | <sub>*`via` on the shadow row; `routes` off the contact row*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R2</sub> | <sub>*the sweep that needed prioritising, deleted instead*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R3</sub> | <sub>*queue depth, and what is shed at the limit*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R4</sub> | <sub>*route expiry — two evictions: cache-limit and last seen*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R5</sub> | <sub>*the timeout is a duration, carried, diminishing inward*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R6</sub> | <sub>*`maxPerTarget` out of config, into code*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R7</sub> | <sub>*drop the ceiling to 1 and run the experiment*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R8</sub> | <sub>*`viaUrl` in a search answer — was already built*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| **R9** | hints carry `{ key, url }` | OPEN — **wire, team review** | **yes** | |
| <sub>R10</sub> | <sub>*`cancel`, exposed to a member*</sub> | <sub>*cancelled*</sub> | <sub>—</sub> | |
| **R11** | the URL rule / SSRF — provenance, and only while a relay row is unkeyed | OPEN — **Andy's to decide**; scoped to the unkeyed window, three candidates | partial | |
| <sub>R12</sub> | <sub>*`last` on a partner row*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| **R13** | no streams between partners | OPEN — **wire, team review** | **yes** | R12 |
| **R14** | open partnering — a row on send or receive, mutual activates | OPEN — **decided**; keyed outranks unkeyed on eviction, numbers open | **yes** | R9, R11, R12 |
| <sub>R15</sub> | <sub>*the per-stream measurement*</sub> | <sub>*done — ~58 KB*</sub> | <sub>—</sub> | |
| <sub>R16</sub> | <sub>*the queue survives a restart — and is a table, not a dump*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R17</sub> | <sub>*suites clean up the homes they create*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R18</sub> | <sub>*durations on a clock that cannot jump*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R19</sub> | <sub>*the load fixture, and seeing it stay lively*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R20</sub> | <sub>*the Governor's remaining job*</sub> | <sub>*deferred*</sub> | <sub>—</sub> | <sub>*revisit when the list is clear*</sub> |
| <sub>R32</sub> | <sub>*working a long contact list: select, bulk remove, filter*</sub> | <sub>*deferred — UI session*</sub> | <sub>**yes**</sub> | <sub>*the verb already exists*</sub> |
| <sub>R33</sub> | <sub>*"mailbox" retired, still in 57 UI comments*</sub> | <sub>*deferred — UI session*</sub> | <sub>**yes**</sub> | |
| <sub>R34</sub> | <sub>*Info shows this node's own disc, cache and RAM*</sub> | <sub>*deferred — UI session*</sub> | <sub>**yes**</sub> | <sub>*pairs with R31*</sub> |
| <sub>R35</sub> | <sub>*a member who has stopped reading is cut loose, and nobody is left waiting on them*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R36</sub> | <sub>*what an error means, in one place — relay emitting codes is for the review*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R37</sub> | <sub>*every presence mark shows its age*</sub> | <sub>*deferred — UI session*</sub> | <sub>**yes**</sub> | |
| <sub>R38</sub> | <sub>*ignore is a mark, not a forgetting — the list is a mark on the memory*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R39</sub> | <sub>*search fans out to memory too, beside every bound relay*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R21</sub> | <sub>*labMaster blocks on netstat; Windows RSTs a full backlog*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R22</sub> | <sub>*censusNarrow reads a file another suite deletes*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R23</sub> | <sub>*a sibling is a route too, and both ends are told*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R24</sub> | <sub>*a search answer is kept until somebody acts on it*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R25</sub> | <sub>*a route is learned at every opportunity; policy does not gate it*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R26</sub> | <sub>*the shadow needs a store, and it is a persist shape*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R27</sub> | <sub>*a presence event about a stranger is discarded, and it is a route*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| **R28** | a label change reaches everybody, at every level | OPEN — **decided `0019`**; hop 1 already built, hops 2-3 **wire, team review** | **yes** | |
| <sub>R29</sub> | <sub>*the shadow row carries rank and provenance*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R30</sub> | <sub>*presence is last-known, and the shadow dates it — the screen is R37*</sub> | <sub>*done*</sub> | <sub>—</sub> | |
| <sub>R31</sub> | <sub>*the owner caps the cache — the screen is R34*</sub> | <sub>*done*</sub> | <sub>—</sub> | |

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
| ~~**R26** the store~~ | — | **decided 2026-09-21**; the six it held are free |
| **R12** `last` on a partner row | R13, and one of R14's four | |
| **R1** `via` | R4, R29 | R29 frees R30 — three |
| **R15** the measurement | R20 | plus four claims nobody can state until it exists |

~~**R26 is the keystone, and it is blocked by nothing but a sentence from
Andy.**~~ — **the sentence came** (2026-09-21, recorded in `0018`): a
database is allowed for the shadow roll and needs no review, and the floor
moves to 22.13 with it. **Six rows freed.** What is left of R26 is one
number, `MAX_AGE_MS`.

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

### The build order

> **Andy:** *"we implement first what solves most problems and has no other
> dependencies."*

Applying that to the two columns gives a sequence rather than a pile. Each
step below depends only on the ones above it.

| | | why here |
|---|---|---|
| **0** | **R27** | One line, depends on nothing, and it opens the largest free source of routes and presence there is. Do it before R19, because it changes what there is to look at |
| **0′** | **R19** | The verification this cycle was scoped around, and the one thing from the original framing still not done. **It should not drift to the end** — it is how we find out whether any of this works |
| **1** | **R26** | The store. Nine rows are shaped around it and six are blocked by it |
| **2** | **R29 + R1** | One sitting: the row gains rank, provenance, `via` and `routes` as a list — and `routes` leaves the contact book, which is the same edit from the other end |
| **3** | **R30 + R4** | Presence on the row, ages in the four tooltips, and the two evictions with their numbers chosen. Both are the row shape being used |
| **4** | **R31** | The cap and the Info screen. Needs a store to have a footprint to cap |
| **5** | **R16** | The queue as a table, in the store that now exists |

**Independent of all of it, any time:** **R15** (nothing blocks it, four
claims wait on it, and R20 cannot be reconsidered without it), **R17**
(harness hygiene), **R12** (`last` on a partner row, which frees R13),
**R10**.

**Last, one sitting:** the review — R9, R13, R28's hops 2 and 3 — and then
R14, which needs R9, R12 and a ruling on R11.

**The one warning in this order.** R19 is the oldest open row and the
easiest to keep deferring, because nothing depends on it and it produces no
code. It is also the only row that can tell us the cycle worked.

### How many implementation cycles

> **Andy:** *"how many implementation cycles?"*

**Eight, for the list as it stands.** The build order above groups into
sittings that can each be clamped, finished and pushed green:

| # | rows | why it is one sitting |
|---|---|---|
| **1** | R27, R19, R17, R12, R10 | the small free ones, plus **the verification this cycle was scoped around**. Nothing here needs a decision |
| **2** | **R26** | the store, alone. A new persist shape and a floor bump land on their own so a regression is attributable to them |
| **3** | R29, R1 | the row shape, and `routes` leaving the contact book — the same edit from both ends |
| **4** | R30, R4, R31 | what the owner sees and when it expires: presence on the row, ages in four tooltips, the two evictions, the cap and the Info screen |
| **5** | R16 | the queue as a table. Alone, because R5's clock rules make a persisted deadline the easiest thing here to get quietly wrong |
| **6** | R15 | a lab measurement producing one number, and R20 reopened against it |
| **7** | R28, R9 | **after the review**, and they are the two small ones |
| **8** | R13, R14 | the transport change and open partnering. R11's ruling is implemented here, not separately |

**Plus one sitting that is not an implementation cycle:** the review, between
6 and 7, covering R9, R13 and R28's hops 2 and 3.

### What that number is worth

**It is eight for thirty-one rows, and the list has grown every day it has
existed.** Born at `25aaac1` with fourteen items (A1–D4), renumbered to
twenty-two, and standing at thirty-one about twenty hours later. Nine of
those rows were added by design sittings that produced **no code**.

So the estimate is honest about the work that is written down and says
nothing about the work that is not. **Cycles 1 and 2 are the ones to trust**
— they are near, small and fully specified. Anything past 5 is an estimate
of a list that is still moving.

**The way to make the number mean something is cycle 1**, and specifically
R19: it is the only row that tells us whether the last two days of design
survived contact with a running system.

### Reconciled against the standing rules, before building any of it

> **Andy:** *"and we will encounter no blockage from the ten commandments
> Moses received?"*

Checked rather than asserted: four principles and fourteen decisions,
against the eight cycles above. **Two real items, one hazard, and the rest
clear.**

> **Andy, 2026-09-21:** *"revisit the R31 against 0015 issue before cycle
> 4. And R16 before cycle 5. The [citation hazard] should be at the end of
> cycle 8."*
>
> **Three gates, and they are part of the cycle they gate.** Each finding
> below is reasoned but not ruled, so it is re-opened at the moment it
> would bite rather than treated as settled by having been written down.
>
> | finding | revisited |
> |---|---|
> | R31 against `0015` | **before cycle 4** |
> | R16 against A-CORRESPONDENT-NODE | **before cycle 5** |
> | R-numbers cited without their cycle | **end of cycle 8** |

#### 1. R31 against 0015 — clear, and there is a precedent

[0015](../decisions/0015-the-owner-watches-a-lever-the-programme-moves-it.md)
is the one that looks like a wall: *"A lever is moved by the programme. The
owner watches it move… an owner who can reach in and move a value is an
owner writing into his own training set."*

**A cap is not that kind of lever, and the tree already holds the
distinction.** `ramLimitMB` is *"the bound the owner configured"*
(`relay.js:3650`) and 0015 leaves it entirely alone, because the programme
governs **within** it and never moves it. R31 is that, for a node's disc.

**The condition this puts on R31, and it is binding:** the programme must
never adjust the cap at runtime. The moment anything auto-tunes it, it
becomes a lever and 0015 bites. An owner's bound is read, respected and
never written by the code that lives inside it.

#### 2. R16 against A-CORRESPONDENT-NODE — a real item, with an answer

**The queue holds the message.** `postQueue.js:203` — `payload:
item.payload`. So persisting it puts **unsent correspondence** into a
store, and 0018's own test says which side of the line that falls on: *did
the owner acquire it, and would they care?* They wrote it. They would.

> `A-CORRESPONDENT-NODE.md:118` — *"permanent, human-readable, portable,
> owned by each party separately, held by no third party."*

**The row has two halves and they are not the same thing.** Scheduling
state — `seq`, `kind`, `attempts`, `until`, backoff, bytes — is the
machine's, and 0018 exempts it. The payload is the owner's.

**So R16 may not simply write the row into sqlite and call it done.**
Either the payload stays on the readable side, or the requirement answers
how an owner sees what is waiting to be sent. This is not a blockage; it is
a clause R16 has to carry, and it was not in R16 before this check.

#### 3. R27 against 0012 and THE-REQUESTER-IS-RESPONSIBLE — clear

Feeding the shadow from every presence broadcast accumulates something
roll-shaped on a node, which is worth naming rather than waving past. It
does not engage either rule: **0012 forbids the bulk question at any door**,
and the node is not asking — it is keeping what arrives unasked, which
0012's own correction explicitly blesses. **THE-REQUESTER-IS-RESPONSIBLE**
is about what a relay owes a question, and there is no question here.

#### 4. R26's floor — clear

*"A node can afford no dependencies outside native node.js"*
(`NODE-AND-RELAY.md`). `node:sqlite` is native, so the premise holds. The
floor moving 18 → 22.13 is a **product change**, not a rule breach, and it
is recorded in 0018 where it can be vetoed.

#### 5. R14 against 0013 — clear, by the eviction order

*"Does this make a relay's cost a function of anything other than time?"*
No: the roll's bounds fix its size, and request pressure changes **who is
in it**, not how big it is. That is what keyed-outranks-unkeyed buys.

#### The hazard: an R-number cited without its cycle

`A-CORRESPONDENT-NODE.md:117` says *"once R16 lands"* — and means a
**different cycle's** R16, not the queue one two sections above. **R-numbers
are per-cycle and are being cited as though they were global.** Harmless
today because somebody who knows both can tell; a trap for the session that
does not. A citation to a requirement needs its cycle, the way a citation
to a line needs its commit.

**Build now, nothing in the way:** **R26** (the store, which nine other
rows are shaped around), **R27** (one line, node-side), R17, R12, R19,
**R15** (method written, four claims waiting), R10, R1 whole — and behind
R26, R16, R29, R30 and R31.

**For the review, when that list is empty:** R9, R13, and R28's hops 2 and
3. **Three rows** — R26's persist shape left this pile on 2026-09-21, and
every one that remains is a packet on the wire.

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
and **built 2026-09-21 in cycle 3.**

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

### Built 2026-09-21 — cycle 3

**`via` is carried at every door.** `onRoute(url, body)` always knew which
relay the announcement came in on and passed it no further; it is now half
the route's key, with the rank each door is entitled to — PROVED for a
signed announcement, ARRIVED for a packet, HOST for a relay speaking about
its own member, HEARSAY for a pasted key.

**`routes` left the contact book, and `learnRoute` with it.** One reader
(`hub.handlePost`'s hints) now asks the shadow, best-ranked first — which
the book could never do, being newest-first with no idea who had said
what.

**The old safety became structural.** *"A relay may improve a contact row
and never create one"* was enforced by `learnRoute`; there is now nowhere
in a row for a route to go, which is the same shift 0012 gave the one-hop
rule.

**And a node that already has them keeps them.** `server.js` moves any
`routes` still in `contacts.json` into the shadow once at boot, at
HEARSAY, because nothing in the book recorded who said them. Idempotent,
silent when there are none, and the field falls away on the next upsert —
no flag, nothing to remember.

**Verify:** `spirit/test/routeStash.js` — rewritten, because its premise
changed: the verb is gone, a fresh row has no `routes`, a STRANGER's route
is kept now where it used to be dropped, the book still gains nobody,
deleting a contact leaves the memory, and an old book's routes can be read
back out for the import.

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

### Closed 2026-09-21, cycle 4 — it had been built in pieces

**Both evictions exist as queries**, and neither was built under this
row's name: the age bound is `sweepOlderThan` at **30 days** (cycle 2,
R26), and the space bound is `sweepToBytes` against the owner's cap
(cycle 3, then R31). Every sweep takes the swept peers' routes with it.
What was left of R4 was noticing it was done.

**Superseded in part, the same day, by `0021`.** The age half is gone —
Andy: *"I don't see why the node should throw away memories when the 20
Megabyte cap is not exhausted yet..... It would be a mistake we're trying to
rectify."* Space is the only eviction; last seen orders it within each tier
of the mark (R38).

**Verify:** `spirit/test/nodeStore.js` — there is no age sweep and an old
row survives; the space bound holds the file under its cap, oldest first,
and the file gives its pages back.
`spirit/test/seenPeers.js` carries the same claims through the shadow.

**Status:** DONE

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

> **Andy, 2026-09-21:** *"cancel is cancelled. My decision."*

R5 removed the reason for it. The node now tells the relay how long it
will wait and the relay cannot hold on longer, so the gap this closed
cannot open.

**Status:** DEFERRED: cancelled by Andy — R5 made it unnecessary, and a
verb on the wire is not worth keeping for a caller who changes their mind
early.

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

### A relay row is keyed or it is not, and that bounds the whole problem

> **Andy:** *"a relay row has a keyed-status, implicitly. Until
> keyed-status is achieved, the url ALSO serves a similar purpose to the
> handle in an enrollment invite for members."*

**The status is already in the tree, unnamed.** `relayKeys.pinned(rootDir,
url)` returns `''` when nothing is on record (`relayKeys.js:81`), so every
relay row is in one of two states:

| | what identifies the relay | what a wrong URL costs |
|---|---|---|
| **unkeyed** | **the URL** — `relayKeys.js:52`: *"A URL is the identity of a relay as far as this node is concerned"* | everything. There is nothing to check the answer against |
| **keyed** | the pinned key, accepted by a deliberate act | **an unverifiable answer, not a compromise.** The signature fails |

**And the parallel is exact: members already made this migration.** An
enrolment invite hands out a *handle* — temporary, owner-minted,
single-purpose — and the moment the seat is claimed the key becomes the
identity and the handle is display only (`relay.js:1424`: *"Every operation
is by key now; labels serve search and display only"*). **Relays have the
handle phase and have not had the migration** — `relayKeys.json` is still
indexed by URL, which is right for the handle phase and is residue after
it.

**What this does to R11: the exposure is a window, not a policy.** A strict
rule is needed while a row is unkeyed, and after that the key does the work
the rule was standing in for. So the rule can be as narrow as an invite is,
because it covers as little.

**And the window has exactly one legitimate purpose.** The only thing worth
dialling an unkeyed URL for is its key — `GET /api/relay/key`
(`hub.js:2080`). That gives a rule that is checkable rather than
judgemental:

> **An unkeyed URL may be dialled for its key and for nothing else.**

**Plus the clause that is the actual SSRF defence:** the answer from an
unkeyed dial **never flows back to whoever supplied the URL**. A permitted
dial is still an oracle if its result — or its timing, or the shape of its
failure — is reported to the party that chose the address. Narrowing *what*
may be dialled without closing *what comes back* leaves the useful half of
the attack intact.

### One concept, two records — and the relay's is the evolved one

> **Andy:** *"a partner record's URL is akin to the node's
> relay-records."*

They are the same thing written twice, and comparing them says which rule
to keep:

| | the node's | the relay's |
|---|---|---|
| file | `relay-state/relayKeys.json` | the `partners` roll (`relayStore.js`) |
| keyed by | **the URL** | **the relay key** |
| holds | pinned key, seat, first seen | url, owner key, `status`, `since` |
| keyed status | **implicit** — `pinned()` returns `''` | **explicit** — a `status` field |

**The relay's record is further along, and the node's is the one carrying
residue.** Keyed by URL is right while the URL is the handle and wrong
after; the partner roll already keys by the thing that survives the
handshake. That is the migration members finished in cycle 3 (*"Every
operation is by key now"*) and relays have half-finished.

**So one rule covers both**, which is the practical value of the analogy:
whatever R11 decides about dialling an unkeyed address, it is the same
sentence for a node reaching a new relay and a relay reaching a new
partner. Two implementations, one rule, rather than two rules that drift.

### The URL is not a variable

> **Andy:** *"the url is not a variable in the partner roll."*

**Written once, with the key, and never moved by a later message.** This
closes an attack the keyed-status framing would otherwise leave open: if a
row's URL could be updated, then **reaching keyed state would be worth
attacking for** — partner honestly, wait to be trusted, then re-point the
row at an internal address and have a trusted relay dial it. Pinning the
key while leaving the address mutable pins the wrong half.

**So the row's immutable unit is the pair**, `{relayKey, url}`, and a
message naming a different URL for a known key is **not an update**. It is
a new row at best and a refusal at worst — never a move.

**The owner may still remake one**, and does today: `setPartner`
(`relay.js:790`) removes the owner's row and writes a fresh one, so a
re-promotion to a new address is a new row with a new `since`. That is an
owner verb and stays one. **The rule is that a PEER's message may never
move a row**, which is precisely what R14's open partnering would
otherwise introduce.

**And the two records are symmetric in exactly this.** Each has one
immutable pair and one half that is the index:

| | index | the other half | if it changes |
|---|---|---|---|
| node → relay | the URL | the pinned key | **reported, never resolved** (`relayKeys.js:31`) |
| relay → partner | the relay key | the URL | **not a variable** |

Neither record lets a later message silently move either half. They arrive
at it from opposite ends, which is why the pair is the thing to state
rather than the field.

**And `relayKeys.js` already wrote the caveat both of them need**
(`relayKeys.js:25`): *"IT PROVES CONTINUITY, NOT INTEGRITY... a box that
was crooked from its first boot pins perfectly."* With it, the handling
rule (`:31`): **a changed key is reported, never resolved** — which a
partner row must do too, rather than quietly re-pinning.

### Three candidates, now scoped to the unkeyed window only

Each of these is a rule about **which URLs may enter the window**, not about
every dial this node ever makes:

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

**Built 2026-09-21.** The column, its migration, and the one thing that
writes it.

**`touch` is separate from `put`**, because they are different events with
different authors: `put` is somebody deciding a partnership exists, `touch`
is the wire saying it still does. A stamp that rewrote `since` or `url`
would let the second quietly undo the first.

**Any answer counts.** A partner replying *"no matches"* has worked; a
partner refusing has worked. Only a promise that rejects — no answer at
all — leaves the column where it was. **It never evicts:** the roll is the
reach, and a partner silent for a month is still the only route to its
members.

**The migration was the part that could have shipped broken.**
`CREATE TABLE IF NOT EXISTS` does nothing to a table that exists, so a live
relay would have failed on the first WRITE rather than the first read.

**Verify:** `spirit/test/relayStore.js` — the empty default, a stamp that
moves nothing else, a stamp for a non-partner that creates nothing, and a
database built with the OLD schema by hand that gains the column, keeps its
rows and takes the write.

**Status:** DONE

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

### The mechanics, decided 2026-09-21

> **Andy:** *"when a partner request is sent OR received, it enters the
> partner-roll immediately, without being active. The moment a partner
> request is mutual, partners are in keyed-mode on both sides, and
> available mutually."*

**Reciprocity replaces approval.** There is no accept verb, because
answering in kind is the acceptance. A stranger cannot make you active
with them; only your own side asking can.

**And this is already the principle — what changes is the gate, not the
rule.** `setPartner`'s own note (`relay.js:776`): *"No third party's
consent is bypassed: partnering only creates routes between the two
relays' own members, and **the other relay's owner must promote this one
in turn**."* Today that mutual promotion is two humans doing it by hand.
This automates it and keeps the requirement exactly.

### A row exists from the first move in either direction

One row per counterpart, created on **send or receive**, inert until both
have happened. So the row has to record **which directions have occurred**,
and the status is the answer rather than a fourth fact:

| stored | |
|---|---|
| **we asked them** | this relay sent a request |
| **they asked us** | a request arrived and verified |
| `status` | **derived**: both → `partnered`, one → `requested` |

**Derived rather than written**, because a status stored beside its own
inputs is a thing that can disagree with them. `relayStore.js:24` reserves
`requested` for exactly this state; what it cannot express on its own is
*which side asked*, and that has to live somewhere whatever the status is
called.

### An inactive row is already inert, and that was checked

Both consumers of the roll filter on the positive value today:

- `partnerByRelayKey` (`relay.js:856`) — `p.status === 'partnered'`, so an
  inactive row resolves to **no identity**: it cannot open a stream, and
  cannot be authenticated as a partner.
- `partners()` (`relay.js:881`) — the same filter, so an inactive row is
  in no search fan-out and no forward.

**So a second status value costs nothing at the gates.** The risk is a
*third* consumer written later that reaches for `store.partners.all()` and
forgets — which the store can close by offering `active()` and making
`all()` the deliberate choice.

### What "mutual" has to mean, or the mechanic is forgeable

**Two verified arrivals, not two claims.** The roll is keyed by relay key,
so activation must rest on a request that demonstrably came **from** that
relay — not on a body that names it. A partner request is an ordinary
signed post under the decided direction (*"the A to B hop will be a
request"*), so the transport already supplies this; it is written down
because the mechanic depends on it and nothing else in this section says
so.

### The tie to R11

**The inactive row is the unkeyed window.** A row that has been asked for
in one direction only is exactly the state where a URL is standing in for
an identity, and *"an unkeyed URL may be dialled for its key and nothing
else"* is the rule that covers it. Mutual is what closes the window: keyed
on both sides, and the URL becomes an address again.

### Keyed status is the eviction order, not a second roll

> **Andy:** *"it's keyed status. If unkeyed, may cause faster eviction, and
> achieving mutually-keyed status makes it harder to evict."*

**One roll, bounded as 0016 says — age and space — and keyed status decides
who goes first when it must shed.** Not a separate quota for pending rows,
which would be a second number to choose and to get wrong.

**This is the third appearance of one pattern**, and it is worth naming so
the next case is recognised rather than re-derived: the post scheduler's
*class outranks age*, the shadow's *rank first, recency second*, and now
*keyed outranks unkeyed*. **A cheap claim never displaces a proven one.**

**What it buys, stated as the property it is:** a flood of partner requests
**cannot displace a working partnership.** Every row it creates is unkeyed,
so it competes only with other unkeyed rows. The worst an attacker achieves
is crowding out *other pending requests* — a denial of **forming new**
partnerships, never of existing ones. That is a much smaller harm and it is
bounded by the same two numbers the roll already needs.

**And it makes the cost honest under 0013.** *"Does this make a relay's
cost a function of anything other than time?"* No: the roll's size is
whatever its bounds say, whoever is asking, and pressure changes **who is
in it**, not how big it is.

**The residual, said rather than left to be discovered.** A genuine inbound
request can be evicted before its counterpart arrives, so partnering may
need a second attempt under load. That is the right way round — a retry
costs one packet, and the alternative is letting a stranger's request
outlive a partner's row.

**Status:** OPEN — **mechanics and eviction order decided; the two numbers
are not chosen.** Needs R9, R11 and R12.

### R15 — the per-stream measurement

> **Andy:** *"it's on the relay? what's the problem?"*

**Fair, and the honest answer is: not much.** This requirement was carried
for a day as a heading with no body, which read as difficulty. It is a
morning on the lab, and the instrument is already built.

### The instrument exists and is already streamed

`relayStatus.report` carries the relay's own memory on every owner
report — `relay.js:3678`:

```
proc: { rss: mem.rss, heapUsed: ..., heapTotal: ..., uptime: ... }
```

So nothing has to be added to the relay to measure it. **Open N streams,
read the relay's own report, take the slope.** `labMaster` already spawns
relays and nodes; the fixture is stream-holders and a sampler.

### What is actually being replaced

`governor.js:54` — `STREAMS_PER_MB = 16`, which that file's own comment
calls a guess. The ceiling is `ramLimitMB × STREAMS_PER_MB`, so the whole
allowance rests on this one number.

### The three things to get right, which is all the difficulty there is

1. **RSS, not `heapUsed`.** A stream's cost is mostly **not on the V8
   heap** — socket buffers are the kernel's. `heapUsed` will undercount
   and give a flattering number; `rss` is what answers *"will this box run
   out"*. Worth noting that `governor.tick` is fed `heapUsed`
   (`relay.js:3774`), which is a separate question for R20.
2. **A slope, not a delta.** GC timing makes any single before-and-after
   reading meaningless. Sample at 0, 100, 200, 400 streams and fit a line;
   the intercept is the relay's fixed cost and the gradient is the answer.
3. **Idle and active are two numbers.** An idle held connection and one
   with a payload in flight do not cost the same. The Governor's ceiling
   needs the **idle** one — it is bounding how many may be *held* — and the
   active figure belongs with the request budget, which already has its
   own arithmetic.

### Why it is worth doing before the things that wait on it

Four claims cannot be made until it exists: what a micro-relay costs,
whether *"1000 members"* can be said to anybody, whether `connections`
stops being a lever, and how many members a box holds. **R20 — the
Governor's last job — ends when this lands**, because `tick()` exists to
correct a ceiling that is only wrong because the constant is a guess.

### Measured 2026-09-21

**~58 KB per held stream**, from the slope of the last segment, with a
median of three samples at each step.

**`STREAMS_PER_MB = 16` implies 64 KB, so the guess was ~10% pessimistic**
— good, and wrong in the safe direction. The Governor's ceiling sits
slightly below what a box would actually carry; nothing was ever in
danger.

**And the method earned itself twice.** The first version took one sample
per step and two runs disagreed by 15%, with one step reading LOWER than
the one before it. The early rows still read 7 KB and 33 KB per stream,
because the first hundred connections fit in memory the process had
already reserved — a single before-and-after reading would have produced
any number between 7 KB and 58 KB depending on where it landed.

**Four claims can now be made.** What a micro-relay costs, how many
members a box holds (~700 on 100 MB), whether `connections` stops being a
lever, and R20.

**It is a tool, not a suite** — `spirit/test/measureCapacity.js`, listed in
`runAll.js`'s `NOT_A_SUITE` with its reason. It spawns two servers, holds
800 sockets and writes 11,000 rows: a minute of wall clock, and no
pass/fail claim to make.

**Verify:** `spirit/test/measureCapacity.js` — and it is the unusual kind,
worth saying rather than glossing. It makes **no pass/fail claim**: it
measures and prints, and what it protects against is not a regression but
a number going quietly stale. `README/CAPACITY.md` carries its output, its
method and the command to run it again.

**Status:** DONE — measured, written up, and re-runnable.

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

### Not merely persisted — a table

> **Andy:** *"the queue might be data-basable."*

**And the selection becomes a query.** `eligible()` (`postQueue.js:238`)
copies the whole array and sorts it on **every pick**:

```
var ready = items.slice().sort(order);
```

`order` is *class first, then age* — which is `ORDER BY rank, seq` over an
index, and the three eligibility tests are a `WHERE`. A queue that holds
days of intent is exactly the one where an O(n log n) scan per pick stops
being free.

**One honest caveat.** Two of the tests are not per-entry: in-flight is per
**relay** and backoff is per **relay+peer pair**. They are small side
tables rather than columns, so the query joins rather than filtering one
table — real, and not a reason against.

**And it makes R26 carry three, not two.** The shadow, this, and R31's cap
all want node-side persistence, which is what puts R26 at the head of the
list.

### The clause this carries, found by reconciling rather than by building

**The queue holds the message** — `postQueue.js:203`, `payload:
item.payload`. So persisting it writes **unsent correspondence** into a
store, and 0018's test puts that on the readable side: the owner wrote it,
and would care.

**Two halves, and only one is the machine's.** `seq`, `kind`, `attempts`,
`until`, backoff and bytes are scheduling state and exempt. The payload is
not. So this requirement may not simply write the row into sqlite: either
the payload stays readable, or R16 answers **how an owner sees what is
waiting to be sent**. Either is acceptable; silence is not.

### The gate, cleared 2026-09-21

> **Andy:** *"revisit … R16 before cycle 5."*

The concern: the queue holds the message text, so persisting it would put
unsent correspondence into `node.db`, which is not the readable side
(A-CORRESPONDENT-NODE). **It does not.** `peerPost` writes the outgoing
message — payload included — to the traffic log BEFORE it is queued
(*"written before the transport is touched"*). The readable, permanent copy
exists first; the queue's is the working duplicate the machine needs in
order to send it, and `secure_delete` takes it off the disc when it
settles. Andy chose, on the recommendation, to store the text rather than
re-read it from the log at every boot.

**One nuance recorded, not fixed:** that first log entry says
`outcome: 'sent'` at the moment of queueing. Harmless while every message
gets one attempt; once patience has an owner setting, a message can sit
queued for days under a log line that already says "sent".

### Built 2026-09-21 — cycle 5

**Written through, read back.** Every entry goes to a `queue` table the
moment it is queued, its attempt count as each attempt starts, and it
leaves the disc when it settles. A backoff a peer had earned goes to
`queue_backoff`, so a node that crashed does not hammer a target it had
been told to leave alone. `postQueue` still does no I/O; it gained pure
restore functions and `peerPost` does the writing.

**Clocks convert at the edge.** The queue measures on `performance.now()`,
which means nothing to the next process, so deadlines go to disc as wall
time and come back monotonic — the time the node spent down counted
against them.

**Nobody is waiting on a restored message**, so it gets a waiter that goes
nowhere and its outcome still lands where it always did: the traffic log.
**That closes a gap that had no name** — a node that died mid-send used to
leave a "sent" entry with no ending, for ever.

**Only the node gets a store.** The relay's own `peerPost` is built without
one, because a relay has no `node.db` and keeps nobody's intentions.

### Three things the suite found, all fixed

- **An expired message was sent one last time.** `pump()` dispatched
  first and swept the spent entries after. Not only a restart's problem:
  a busy target whose `retryAfterMs` outlasted the remaining patience did
  the same. Expire first, then send.
- **The cache cap would have evicted the cache for the queue.** It
  measured the whole file, and the file holds the queue now; at the 1 MB
  floor a backed-up queue could have emptied the cache. It reads the
  cache's own tables from `dbstat` now.
- **The log said a message failed, never why.** It kept `refused, 504`.
  Rows now carry the catalogue's `code` — `gave-up`, `peer-unreachable` —
  the same meaning the presence write uses (R36, retrofitted).

**Verify:** `spirit/test/queueRestart.js` — the message and its backoff on
disc; a restored message waiting out the backoff it earned; resent once it
passes, as the same signed message; a message whose patience ran out while
the node was down not sent, logged as `gave-up`, and its row gone; no
store, no `node.db`. `spirit/test/nodeStore.js` carries the cap's new
measure and the file's shrink, falsified with the vacuum removed.

**Status:** DONE

### R17 — suites clean up the homes they create

Every suite that calls `fs.mkdtempSync` leaves the directory behind.
**160,116 of them were found in `%TEMP%` on 2026-09-20**, and the disc
contention made three consecutive harness runs progressively redder while
each suite passed alone — which reads exactly like a regression and was
not one.

`plantRun.js` shrank each leaked directory from 143 MB to 3.8 MB
(`17c6bc1`) but nothing stopped the leaking: a full run still leaves
roughly two hundred.

**Built 2026-09-21, and measured rather than argued.**

**Closed structurally, not by thirty-eight edits.** `fs.mkdtempSync` is
wrapped once in `testSupport.js`, so a suite written next month is covered
without being told — the tree's own preference (*"a rule that cannot be
broken needs nobody to police it"*, 0012).

**And the first version was not enough, which had to be found by
measuring.** It worked on a probe and a full run still left ~120 behind.
Every survivor held `relay-state/relay.db`: a world that starts a real
relay has SQLite open when its own exit handler runs, and a locked file on
Windows defeats `rmSync` — `force` suppresses *"not found"*, not *"in
use"*. So each child now reports what it could not remove and `runAll.js`
sweeps the list once every child is dead. **Exact, never a pattern sweep of
`%TEMP%`:** the list is the real return values of the real calls.

**Verify:** `spirit/test/runAll.js` is the verification and the fix at
once — it prints what it reclaimed, and the measurement is the count in
`%TEMP%`: **32,584 before, 0 after, and a full run now leaves 0** where it
left +120.

**Status:** DONE

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

### What it needs, checked before starting

**Nothing is missing in the way of machinery.** `targetBusy.js` already
runs a real relay in a real process on a real port, and carries the hard
part: `hold()` — *"a member who is present and says nothing, which is the
whole fixture."* `createPeerPost` takes its request function as an
argument, so a node's real post path can be pointed at a real relay. The
first fixture is assembly.

**What `postQueue.js` already proves in memory**, so this does not rebuild
it: ordering, ties, class before age, per-pair backoff, patience,
head-of-line, the monotonic clock and refusal at the door. What no unit
suite can do is all of it over a socket, under load, against a relay that
is really holding routes.

**And one thing that was missing, now answered by
[0020](../decisions/0020-the-machinery-is-not-a-client-surface.md).**
`hub.js:1784` posts with no options, so nothing in a running node ever
asks the queue to wait — the retry path is built and unreachable. The
obvious repair was a per-post argument from the app; 0020 refuses it and
keeps patience as **node configuration**, an owner's bound like the cache
cap. So this fixture sets patience the way the node will, and does not
grow an app-facing parameter to test itself.

**Built 2026-09-21 — `spirit/test/queueUnderLoad.js`.** One node fires five
posts at once at three targets that are present and silent, plus one that
answers, through a relay in a real process on a real port.

**Asserted from the far side, never from the queue.** 0020 keeps the
scheduler opaque, so the claim is counted from what the TARGETS receive: a
request sitting at a silent member is a slot still held, so two arrivals
whose windows overlap would mean two in flight.

**Falsified before it was trusted.** With `IN_FLIGHT_PER_RELAY` set to 3
the first check goes red — *"two or more were in flight at once: 3"* — and
green again at 1. A check that cannot fail is worse than none, and this
tree has shipped one: the R21 loop's detector matched its own header and
reported REPRODUCED with no failing suite.

**Two things it found**, both of which a unit suite would have missed:

- **The hash is derived, never received.** `relay.js:3123` — *"NO HASH IS
  SENT. The target derives it from the bytes it holds, which is what makes
  it evidence rather than an echo."* The first version replied with
  `msg.data.hash` and the relay answered `400 hash required` five times
  over. A fixture that took the hash off the wire would have been testing
  an echo.
- **A budget the node asks for is the budget it gets.** 900ms per attempt
  end to end, so three stalling targets cost three seconds rather than
  fifteen — R5 working, observed rather than argued.

**And the half no suite can do is done too, 2026-09-21.** The lab world was
rebuilt (`labPopulate.js`, the buddy network: a lab relay, three peers,
all running) and looked at.

> **Andy:** *"a whole bunch of UI issues, deferred. **Response times are
> unchanged.**"*

**That is the claim R19 existed to make.** The cap of one in flight, the
queue behind it, and everything R27 added to the presence path cost
nothing a person can feel. It is not a measurement and does not pretend to
be one — it is the only test for *"reacts as lively as before"*, and it was
the instruction.

**The UI issues are not listed here and are not this cycle's.** Andy:
*"UI changes i prefer done in UI-only sessions using MY node."* They are
deferred as a batch rather than enumerated, because a list written from
somebody else's glance is a list of my guesses.

**Verify:** `spirit/test/queueUnderLoad.js` — one in flight under a burst
of five, a silent target releasing its slot on its own budget, every
caller settled and none hanging, the cooperative target served though it
was queued last, and a post after the burst going straight through.

**Status:** DONE — both halves. The fixtures, and the looking, which Andy
did on 2026-09-21 and reported as unchanged.

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

> **Andy:** *"R20 deferred until we know the basics. We already know the
> governor is afraid of the job, but governor and monitor might look very
> different after the rest of the R-list is cleared."*

**Deferred, and the reason is not just R15.** Measuring the per-stream cost
would tell us what `tick()` should do; it would not tell us **whether a
governor and a monitor are still the right two things**. That answer moves
with the rest of this list — R26 changes what a node persists, R14 changes
what a relay accumulates, R31 hands a limit to an owner — and deciding the
shape of the last governing act before those land would be deciding it
against a box that no longer exists.

*"Afraid of the job"* is the useful part: `governor.js` says in its own
comment that its constant is a guess, so the one act it still performs is
correcting a ceiling it does not trust. That is a symptom to keep, not a
problem to solve now.

**Status:** DEFERRED: the governor's remaining shape depends on R15 and on
what the rest of the list does to the box it governs; revisit when the list
is otherwise clear.

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

> **Andy:** *"we need no peer review for allowing a database to be used for
> the shadow roll. That's a decision."*

**Granted, and recorded in
[0018](../decisions/0018-the-route-cache-belongs-to-the-machine.md)** —
which had left exactly this open. `CLAUDE.md` makes a new persist shape a
team review; this spends that review in advance for this one shape, because
0018 already carries the argument a review would re-derive.

**The floor follows rather than being a second ruling.** A node may take
*"no dependencies outside native node.js"*, so a database is `node:sqlite`,
and `node:sqlite` is **22.13**. Said plainly so it can be vetoed in a word
if it was not intended.

**This was the keystone and it is now off the critical path.** R1's second
half, R16, R29, R30 and R31 all move.

### Built 2026-09-21 — cycle 2

**`nodeStore.js`**, the node's own `relay-state/node.db`, with the same
durability choices `relayStore` makes and the same reasons: rollback
journal rather than WAL (one process, and a file copy cannot catch it
half-written), `synchronous = FULL`, and **`secure_delete = ON`** — which
matters more here than it looks, because what this file holds is not a
membership list but *whose business this node has been doing*. A row swept
for age has to leave the disc, not only the index.

**`seenPeers.js` keeps the rules and hands over the rows**, the way
`relay.js` keeps the rules and `relayStore.js` keeps the roll.

**No in-memory fallback, deliberately.** A second implementation would be
a path the product never runs and every suite would silently test instead.
The suites open a store in a temp home, which is the path the node takes.

**The greedy merge moved into the statement.** `ON CONFLICT ... DO UPDATE`
with a `CASE` per field, so *"never blank what you know"* is a property of
the write rather than a discipline each caller has to remember — and one
round trip rather than a read followed by a write.

**Both evictions became queries** (R4): an index seek for the age bound
and an ordered delete for the space bound, instead of two passes over every
key in memory. That is what 0018 licensed a store to make possible.

**The wiring changed shape.** The shadow was a module-level singleton built
at require time with nothing — fine in RAM, impossible on disc. It is now
`hub.shadow(rootDir)`, cached per resolved home, so nothing depends on
which caller arrives first and a suite can hold two nodes at once.

### The floor, and the one number

**`package.json` now says `node >=22.13`**, and `server.js` refuses to
start below it with a sentence rather than a stack trace — the way
`relayServer.js` already refused. Until now only a RELAY needed 22.13.
**This makes it every user's minimum**, on a machine they own and install
themselves, and it follows from Andy's grant rather than being a second
ruling (`0018`).

**`MAX_AGE_MS` is now thirty days**, up from one hour. The hour was never
a decision — `seenPeers.js` said so itself: it is *"what a cache can
afford while it lives in RAM and loses everything at a restart anyway."*
Three grounds, none of them measurement:

1. It outlives the thing it exists for. *"Any peer a node could possibly
   connect to"* is not a question about this week.
2. **It is not the bound that does the work.** R4 has two evictions and the
   SPACE one is the real limit — the owner's cap (R31). Age is the backstop
   for a row nothing has touched.
3. A route nobody has reconfirmed in a month costs one failed attempt,
   which is all a wrong hint ever costs.

**Declared, not measured, and marked as such in the file.**

**Verify:** `spirit/test/nodeStore.js` — a row written before the store
closes is there when it opens again; it is `node.db` and no `relay.db`
appears beside it; the merge keeps a field a blank write omits and moves
`seen` anyway; both evictions take what they should and a store inside its
bound is left alone; one home is one store and two homes are two.
`spirit/test/seenPeers.js` carries the same claim at the shadow's level —
a route learned before a restart is there after one.

**Status:** DONE

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

**Built 2026-09-21.** `presenceNode.js` — the shadow is fed before the
filter, and the filter is unchanged. Absent teaches the same route as
present (*"not connected"* is still a statement about a member); `gone`
teaches nothing, because the relay has just disclaimed the row it would be
speaking from. No `present` field yet — that is R30.

**Verify:** `spirit/test/presenceNode.js` — the route is learned, the
picture stays contacts-only, absent teaches the same as present, gone
teaches nothing, and a shadow that throws does not cost the node its
presence picture.

**Status:** DONE

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

### Built 2026-09-21 — cycle 3

**Rank first, recency second**, as a property of the write:
`ON CONFLICT ... DO UPDATE` refuses a label from a worse-ranked source and
takes one from an equal source that spoke later. Four ranks — HOST,
PROVED, ARRIVED, HEARSAY — and the default is HEARSAY, so a caller that
forgets to say loses an argument it might have won rather than winning one
it should have lost.

**A route is a pair of doors**, `(peer, via, at)`, in its own table. Andy:
*"peer-key / A-key / B-key — that the key?"* Keyed by destination alone,
a working door and a useless one would have been the same row.

**Presence turned out to be three states, and a bug said so.** The column
was two-valued with a −1 "no opinion" sentinel the merge would swallow —
which did not survive a first INSERT, so the sentinel landed in the column
and read as **present**. Clamping it broke the other half. The model was
wrong: `contacts.js:264` has had three marks all along — *"WHITE is NOT a
dimmer red… they are UNSEEN"* — and 0019 rests on the same distinction.
It is `null` / `false` / `true` now.

**Verify:** `spirit/test/nodeStore.js` — the downgrade refusal, equal rank
deciding by recency, two of my doors to one of theirs as two routes, the
cap shedding worst-first, forgetting a peer taking its routes, presence's
three states, and a `node.db` in the morning's shape migrating with its
one route moved across unranked.

**Status:** DONE

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

### Built 2026-09-21, cycle 4 — the node half

**Every source now writes what it knows**, and only that:

| source | writes |
|---|---|
| a search result | **present** — search is online-only, so being found is the evidence; for every row, not only the clicked ones |
| any reply to a post | **present**, whatever the reply says |
| a refusal | **whatever `spiritErrors` says it means** — busy is present, *peer not reachable* is absent, the rest write nothing |

**The refusal row is R36's reason for existing.** The first version of
this requirement said *"unreachable in a post → not green"*; the catalogue
showed that a busy refusal proves the person is THERE, and that running
out of time says nothing about anybody. One rule would have been wrong two
times out of three.

**Not from the node's own *"not reachable right now"*.** That comes from the
node reading its own presence picture; writing it back would be the node
repeating itself as though it were evidence.

**Search rows are ranked while being written** (R29, retrofitted): HOST
when the relay asked is speaking about its own member, HEARSAY when a
partner carried it.

**The screen half — every mark showing its age — is UI**, and moves to R37
for a UI session.

**Verify:** `spirit/test/presenceLearned.js` — a reply is present; busy is
present; unreachable is absent, carried directly or relayed; five failures
about the waiting leave presence standing; an uncatalogued error changes
nothing; a stranger refused as unreachable gains no invented name or
route.

**Status:** DONE — the node half. The age on screen is R37.

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

**It replaced `MAX_ENTRIES = 500`** — a declared, unmeasured row count in
a unit nobody thinks in, and **measured at 110 KB**. **`MAX_AGE_MS` stays**:
0016's *"a space bound leaves a cache frozen while there is room, and an
age bound leaves it unbounded while there is not"* still holds, and this
replaces one of the two.

**Default: 20 MB — Andy's number and his unit**, *"10 jpeg images from a
modern cell phone"*. Measured rather than estimated: 5,000 rows written to
a real `node.db` came to **225 bytes a row**, so 20 MB is about **93,000
people** — *"we can easily default to a small city."* The first estimate
here said ~600 B on disc and 16 MB; it was 2.7× pessimistic and is struck
in the design note.

**The number is node config, and readable.** Not `identity.json`, which is
the public card. 0018's test — *"did the owner acquire it, and would they
care?"* — says the cache is the machine's and exempt while **the cap is
the owner's and is not**.

**On screen: Info, called "Maximum cache size."** Not shadow roll, not
route cache. Draft copy is in the design note. `UI_DESIGN_STYLE` §1 gives
the floor a real number rather than a refusal, and §6 is the general form
of Andy's instruction.

### Half built 2026-09-21, in cycle 2

**The bound is bytes and the default is 20 MB**, enforced by
`nodeStore.sweepToBytes`, which reads the FILE (`page_count × page_size`)
rather than estimating from a row count — a label is free-form and a row
is not a fixed size.

**And the file had to be made able to shrink**, which only measuring
showed: SQLite keeps a deleted row's pages on a free list and the size
never falls, so a byte cap would evict for ever after one busy week,
reading a number that cannot come down. `PRAGMA auto_vacuum = INCREMENTAL`
at creation, and every bulk delete asks for the pages back — but only when
it actually removed something, because the age sweep runs on every
`note()`.

**What is left is the OWNER's half**: where the number is stored so a
person can change it, and the Info screen showing it as *"maximum cache
size"*. The screen is UI, so it waits for a UI session by Andy's rule.

**Verify:** `spirit/test/nodeStore.js` — the cap holds the file, the
oldest go first, the file gives its pages back, a store inside its bound
is untouched, and a cap no file could meet empties the store rather than
spinning on it. `spirit/test/seenPeers.js` asserts the same through the
shadow.

### The setting built 2026-09-21, cycle 4

**`relay-state/node.json`** — Andy: *"your suggestion fits now."* One field,
in megabytes, the unit he asked for:

```
{ "cacheMaxMB": 20 }
```

**Read once at startup and never written by the node.** That is his rule
for any owner-configured bound — *"MUST be a constant to the governor"* —
and it is also what keeps this on the right side of 0015: the programme
obeys the owner's bound and never moves it.

**A number that cannot work is said, not swallowed.** Below the 1 MB
floor it is raised and reported; not a number, or not JSON, it boots on
the default and reports it. A setting the node quietly ignored would be
worse than none.

**The screen is R34** — the Info app showing what is spent beside the bound
that governs it, in a UI session.

**Verify:** `spirit/test/nodeSettings.js` — defaults with no file and no
file created; the owner's number reaching the shadow in bytes; the floor
raised and said; nonsense and broken JSON falling back and saying so; a
change mid-run waiting for the next start.

**Status:** DONE — the bound and the setting. The screen is R34.

### R32 — working a long contact list: select, bulk remove, filter

> **Andy:** *"makes me desire the old style web feature... a
> select-box-column and a bulk-remove contact feature (doesn't go on the
> wire)."* — *"a list-only-present and search filters on the list
> itself etc..."* — *"all for later."*

**Four wants, one screen**, and they are the same want: a list long enough
to need working rather than reading.

- a select-box column
- bulk remove
- **list only present**
- search filters applied to the list itself

**And pruning is no longer destructive**, which is what makes this
reasonable rather than risky. Andy: *"a lot of 'contacts' will change
because there is a 'memory' now in the shadow-roll."* A removed row used
to take the route and the name with it; the shadow keeps both and survives
a delete by rule. **Bulk remove used to mean throwing away knowledge and
now means tidying a list.** Argued in
[WHAT-A-NODE-KNOWS.md](../relay/WHAT-A-NODE-KNOWS.md).

**None of it goes on the wire.** Removing is local; filtering and
selecting never leave the browser. *"List only present"* is a filter over
the presence the screen already draws — `contactsPresenceMark` has the
three marks today — and is not a question asked of anybody.

**Raised by looking.** A work node carried 33 contact rows, 19 of them
with no label at all — so they read as key tails, and a world built to be
looked at was unreadable. Andy: *"these worlds are unfamiliar and badly
labeled with end-of-key label texts."* Removing them one row at a time is
the reason the feature is wanted.

**It needs nothing new below the screen, which was checked rather than
assumed.** The verb exists and is already used:

| | |
|---|---|
| `contactBook.forget` | `contacts.js:442` |
| the `forget` action | `hub.js:1354` |
| the verb a client calls | `contact.forget`, `server.js:1379` |
| an existing caller | `contactsDetails.js:382` |

So bulk remove is **N calls to a verb that works**, and Andy is right that
none of it goes on the wire: forgetting your own contact is local to your
node. *(`contactBook.forget` keeps a blocked row and only downgrades it —
deleting one would readmit the person the moment they wrote. Bulk remove
inherits that and must not special-case it.)*

**Status:** DEFERRED: it is UI, and Andy takes UI in dedicated sessions on
his own node — *"UI changes i prefer done in UI-only sessions using MY
node."* Nothing below the screen is missing, so it waits on a session
rather than on work.

### R33 — a retired word is still teaching the next reader

> **Andy:** *"this host is only a relay/router (not a mailbox!)."*

`DICTIONARY.md:27` retired *mailbox* on 2026-09-15 and allows it to
survive *"in comments about history, which is where a retired word
belongs."* **57 occurrences are not history.** They are present tense, in
five UI files — `relayChat.js` (25), `natterDetails.js` (19),
`natter.js` (10), `contacts.js` (2), `info.js` (1): *"which mailbox this
screen is"*, *"the mailbox's peers"*, *"one row per mailbox"*.

**None of it reaches a screen** — checked; every one is a comment. What it
reaches is the next session to open those files, which is worse in a tree
where comments carry the reasoning.

**Status:** DEFERRED: UI files, so it belongs to a UI session by the same
rule as R32.

### R34 — the Info app shows what this node is actually using

> **Andy:** *"this is also a sexy thing for the info app"* — *"disc usage,
> current capacity for peer-memory etc..."*

**Two different things wear the word capacity, and only one belongs on a
screen.**

| | where |
|---|---|
| **the benchmark** — what a box of a given size holds | `README/CAPACITY.md`, produced by a tool that spawns servers |
| **the live reading** — what THIS node is using right now | the Info app |

A node cannot run the benchmark; it can report itself. What the screen
wants is the second:

- **disc usage, split the way Andy split it**: the program, the node's own
  bookkeeping, the auto-memory, and your space
- **the peer cache**: how much of its cap is spent, and how many people
  that is
- **the traffic log**, because it is the only file that grows on its own
- **RAM at rest**, which answers *"is this thing heavy"* — it is not

**It is allowed, and the rule says why.** `0020` keeps the machinery
opaque to the CLIENT; the owner is not a client (`0019`), and these are
values the node has already decided rather than the structure underneath
them. A size, a fraction, a count — not the rows.

**It pairs with R31's other half**, which puts the cache *setting* on the
same screen. Showing what is spent beside the bound that governs it is one
panel, not two.

**Status:** DEFERRED: it is UI, and Andy takes UI in dedicated sessions on
his own node. Nothing below the screen is missing — `nodeStore` already
answers `bytes()` and `size()`, and the rest is `fs.statSync`.

### R35 — a member who has stopped reading is the unbounded case

> **Andy:** *"the kernel might also have to reserve buffer space
> equivalent to spirit-messages + overhead...."*

**The question he asked is already answered by the relay.** Sending a full
`PAYLOAD_MAX` message to each of 400 members got **16 through**:
`DEFAULT_PER_REQUESTER = 16` (`router.js:27`) refused the other 384 before
they reached a socket. In-flight bytes are bounded by the requester cap,
not by buffer arithmetic.

**The fixture surfaced a different hazard, and this is the row for it.**
To force the send buffers to fill it used raw sockets that never read —
and the *idle* kernel cost per stream went from **~14 KB to ~194 KB**.

**A member who has stopped reading is up to an order of magnitude more
expensive than one who has not, and nothing caps it**, because it is not a
request. It is a socket doing nothing, slowly. Every cap in the system
counts requests; this costs memory without making one.

**Why it matters more than it looks.** If `ramLimitMB × STREAMS_PER_MB`
becomes the whole governor, that arithmetic assumes every stream costs the
same. A stalled reader breaks the assumption the ceiling rests on — so
this is the one thing that might still justify an observer, and it is a
narrower job than the Governor ever had.

**The number is not to be trusted yet** and the shape is: non-paged pool
is system-wide, loopback puts both endpoints on one box, and the sample
was one run. **What to measure:** the same steps with reading and
non-reading members side by side, on both platforms.

**The kernel was the smaller half.** Reading the code for the measurement
found the real exposure: the relay's stream sink called `res.write` and
ignored its answer, and nothing in the tree read `writableLength`. Once the
kernel's buffer is full, Node keeps every further write *in the process* —
each packet aimed at the member, each heartbeat, each presence event —
until the TCP connection dies, which a live peer that simply does not read
never lets happen. Proved on a real socket: with the cut removed, **50 MB**
sat in the process for one reader.

**Decided.**

> **Andy:** *"if the output buffer goes past 2x MAX_FULL_PACKET, shouldn't
> the relay just send a disconnect, then cut the connection loose?"* —
> *"this needs only documenting, and checking if a pending foreign request
> is still pending, so that one can be returned with an error...."* —
> *"and vice versa"*

- **The cut, and no goodbye.** A reader that has stopped will not read a
  disconnect either; the socket closing is the only signal that reaches it.
- **`STREAM_EVENT_MAX` = 6 × `PAYLOAD_MAX` + `WIRE_HEADROOM` = 98,816 B.**
  "A full packet" measured in the bytes it costs on a stream: a text of
  control characters is written by JSON as six bytes a unit, and the relay
  checks a text's length, not its alphabet. The built worst case is 98,573 B.
- **`STREAM_BACKLOG_MAX` = 2 × that ≈ 193 KB**, counted in what Node holds
  (`writableLength`), which fills only after the kernel's buffer — so an
  honest reader is cut only once it is behind by the kernel's buffer *and*
  two worst-case packets.
- **Asked of them:** every route the cut member was the target of is
  answered now, `503 peer not reachable`, the way its asker waits — a
  relay-signed reply down a stream, this relay's own post settled here, a
  partner's through the tunnel answer. The reason (`stopped reading`) goes
  to the owner's monitor, not onto the wire.
- **Asked by them:** their routes are dropped, so a late answer meets
  `404 no such request` rather than `200 delivered: false`, which is what it
  got before.
- **Only for the cut.** An ordinary close settles nothing: `/reply` needs no
  stream, so a member whose stream dropped may still answer what it read.

**Built.**

`streamSink.js` (the sink, moved out of `relayServer.js` so a real socket
can test it), `limits.js`, `router.release`, `relay.failRoutesOf`. Suite
`test/stalledReader.js`, 12 checks; with the cut and the settlement removed,
7 fail.

**Not closed by this, and said plainly:** a *healthy* reader can be cut if
enough large events land on it in one tick — the check runs after each
write, before anything drains. In practice one target takes one request at
a time (`DEFAULT_PER_TARGET = 1`), so the case needs sixteen large replies
to its own requests arriving at once. Watch for it; do not build for it.

What remains for R20 is only whether anything else justifies an observer —
this no longer does.

**Verify:** `spirit/test/stalledReader.js` — the bound holds for the built
worst case; a reader that stops is cut on a real socket and one that is
only slow is not; the asker is told, the late answer is refused, and an
ordinary close settles nothing.

**Status:** DONE

### R36 — what an error means, in one place

> **Andy:** *"now that we know most of failure states, wouldn't it be time
> to centralize the meaning of errors of status codes, maybe number-text
> pairs. looks like we have a missing fundamental...."*

**Found from the periphery, healed in the core first (0017).** Deciding
what a failed post should do to a presence dot turned out to depend on
WHICH failure — and the tree had no way to say which. About seventy error
sentences across eleven statuses; **503 carried seven meanings**, and the
only thing separating *busy* from *unreachable* was free text.

**`spiritErrors.js`** — one module for relay and node. 48 codes, each
carrying what a caller needs: **presence** (true / false / none), **retry**
(no / yes / after) and **fault** (caller / target / relay / node). A busy
refusal says PRESENT; *peer not reachable* says ABSENT; running out of
time says nothing. A single rule for "failed" would have been wrong two
times out of three.

**The key is a string, not a second number.** HTTP already is the number
and is exactly the ambiguous part; `peer-unreachable` reads on its own in
the permanent traffic log.

**The suite reads the tree.** Every `status: N, error: '...'` and
`fail(res, N, '...')` must be catalogued with a status the catalogue
agrees with, or the harness goes red. **It found three on its first run
that the hand inventory had missed** — each written across two lines,
where a line-based search could not see it.

**One inconsistency recorded rather than fixed:** *"no such peer"* is 404
in seven places and 403 in two. Kept as `alsoStatus`, with a check that
tells whoever reconciles it to remove the exception.

**The rule above the others:** an uncatalogued error claims nothing about
presence, so a sentence added next month cannot paint somebody red.

**Phase B is the review pile:** the relay emitting `code` directly touches
its refusal whitelist. Until then `classify` maps what arrives today —
marker first, then the sentence, then a prefix.

**Verify:** `spirit/test/spiritErrors.js` — every error site in the tree
catalogued with an agreeing status, presence per failure, markers
outranking text, prefixes for runtime sentences, the 403/404 exception
kept honest, and no sentence claimed by two codes.

**Status:** DONE — Phase A. The relay emitting codes is for the review.

### R37 — every presence mark shows its age

> **Andy:** *"the gap is that the tooltip doesn't include the time stamp."*

**The half of R30 that is UI.** Presence is last-known now (0019), and the
shadow dates it — but all four tooltips are still written in the present
tense (*"is holding"*, *"says they are connected"*), which is the live claim
the rule says presence is not. Four strings, one field, no new control:
`contactsPresenceTitle` (`contacts.js:288`) and `contactsSeenMarkTitle`
(`:322`).

**And the null state is waiting for it.** The shadow stores presence as
three values, so *"nobody has said"* can finally read differently from
*"said absent"* — the white mark `contacts.js` has always kept distinct.

**Status:** DEFERRED: UI, and Andy takes UI in dedicated sessions on his own
node. Nothing below the screen is missing.

### R38 — ignore is a mark, not a forgetting

> **Andy:** *"ignoring means only: mark this row as "ignored"."*

**Decided in `0021`.** The node remembers every peer it meets; the list is
a mark on that memory, and the mark is the protection. To build, behind
the verbs that already exist (`peer.list`, `contact.*`):

- the mark on the shadow row — none, `held`, `added`, `ignored`, blocked
- the space sweep sheds in 0021's order — unchosen, ignored and blocked,
  held — and never `added`; a full memory refuses the next add, with a
  catalogued code
- the age eviction goes (`MAX_AGE_MS`); last seen orders the sweep only
- `frontDoor` reads the mark, and `contactBook`'s rows come from it

The words on screen (*"Ignore — No row"*) are the UI session's.

**Built.**

- **The mark** is two columns on the shadow row, `choice` and `blocked`,
  with a partial index on the chosen ones (`nodeStore.js`). Old files gain
  them by migration.
- **One eviction.** `sweepToBytes` sheds unchosen, then ignored and blocked,
  then held, oldest first within each, and its query cannot select an
  added, unblocked row. `MAX_AGE_MS` and `sweepOlderThan` are deleted.
- **The book marks the memory on every save** (`contacts.save` →
  `syncMarks`), and once at boot (`server.js`), so no caller can forget
  to. Leaving the book takes the mark off; the memory stays.
- **A full memory refuses the next add**: `507 memory is full of the people
  you added` (`memory-full`, catalogued) at `contact.accept`, at unblocking
  somebody who had been added, and at adding by key. Under *Acquire* a
  stranger who writes when it is full is heard and not added; so is a claim
  on an owned relay.
- **The door marks `ignored`** — a stranger dropped under *Ignore*, within
  the floor's budget — and never over a held or blocked row: what the owner
  decided outranks what the door did.

**One line drawn while building, for Andy to overrule:** `frontDoor` still
decides from the book, not from the `ignored` mark. The mark records what
the door did under the policy of the day; letting it gate would mean that
switching from *Ignore* to *List them* never lists anybody ignored before.

**Verify:** `spirit/test/chosenMarks.js` — the sweep sheds in order under
fourteen squeezes and never reaches the 60 added, though they are the
oldest; a spent cap refuses the next add and blocking makes room; the book
marks added, held and blocked, and forgetting unmarks; the door marks a
stranger and leaves a held person held; under Acquire a full memory adds
nobody. With the protection, the order, the book sync or the door mark
removed, it fails.

**Status:** DONE

### R39 — an offline search answers from memory

> **Andy:** *"thing is. if the userbox is offline, search can revert to
> memory....."*

**What 0021's memory is for.** `peer.list` and `peer.find` are wire verbs
and fail when the box is offline (`server.js:1490-1491`). Kept memory lets
the node answer from what it has met instead, marked as from memory and
dated — a value crossing, not the store (0020).

> **Andy:** *"in fact if search fans out to all bound relays first, why not
> to the memory also?"*

**Ruled: always alongside.** Memory is one more source in the fan-out
search already does (`Promise.all` over every bound relay, merged by key,
`hub.js` ~1946). Offline it is the only one that answers; online, a relay's
live row wins over the remembered one for the same key, and a remembered
row keeps its age.

> **Andy:** *"the relays result will take precedence until timeout()"*

**The relays lead; memory is what is left at the timeout.** The search waits
on its relays as it does today, and a relay's row wins wherever one comes
back. When the wait ends, memory fills in what no relay said — so memory
never delays a search and never overrides a live answer.

> **Andy:** *"hmmm, chosen ones should always be included. it kind of would
> look dumb if contacts couldn't list-search it's chosen ones..."*

**Chosen people who match are always in the answer.** The slot cap and the
absent drop thin out strangers; a person the owner chose, and who matches,
is never cut by either.

> **Andy:** *"When the wait times out, memory fills in the people no relay
> answered for, filtered exactly and prioritized exactly like search
> results."*

**One ranking, not two.** Remembered rows go through the same graded match
the relays use (`peerSearch.search`, `gradedSearch`, `SLOTS`) and the same
node-side filter and order (`hub.js:1965` drops `present === false`;
`hub.js:2117` sorts). Exactly means the drop applies too: a peer
remembered as *absent* is left out, one whose presence is unknown is not.

**Built.** `hub.fromMemory`, called once every relay has answered or timed
out, from `handleSearch`:

- a key any relay answered for is skipped, so the live row always wins;
- strangers go through `peerSearch.search` with the relays' slot count,
  after the same `present === false` drop;
- anybody the book holds — added, held or blocked — who matches is
  returned whatever the slots and their last-known presence;
- each remembered row says `fromMemory`, carries `seenAt` and its
  last-known `present`, and is **not** noted back into the shadow — a
  memory is not news;
- a node with no connection answers from memory, `asked: 0` and every
  relay named silent, where it answered `503` before.

**Verify:** `spirit/test/searchMemory.js` — the relay's row wins; memory
fills in, dated and routed; an absent stranger is dropped; strangers get
the slots and `more` says so; all 37 chosen come back past 32 slots,
including one last seen absent; a remembered row keeps its date; a silent
relay and a missing connection are both answered from memory. Ranking the
chosen as strangers, or keeping the absent, fails four of its checks.

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
