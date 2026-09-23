# Cycle 11 — the owner's relay record

**Opened 2026-09-23 from `36406eb`. Nothing built. Seven requirements.**

> **Andy:** *"relay record is in the alpha"* — and on where it belongs:
> *"node-side app issue"*, in a database because *"this is not user-stuff,
> its machine and network maintenance"*.

Decision 0015 left this open in as many words: *"What 'record' means
concretely. A monitor draws the current report; the analysis Andy
describes needs a **series** — every move, its reason, its capture time,
kept. Nothing keeps one. Where that store lives, what it costs and what
bounds it is a design sitting, and it is the substance of this decision's
second half."* (`0015-…:152`). This is that sitting.

---

## THIS CYCLE RUNS UNDER A NEW WORKING AGREEMENT

Ruled by Andy, 2026-09-23. It changes who writes what, and it is stated
here rather than in a note because a later reader has to know why this
cycle's suite has a different author from its source.

- **wsl-claude owns this cycle's suite. Claude owns the source.** If the
  implementer needs an assertion, it is asked for, not written.
- **Neither reads the other's artefact until the close.** Andy:
  *"on-the-go reconciliation will hide the divergence."* Pushing is
  continuous; reading is the contaminant.
- **Nobody yields mid-cycle.** *"you don't yield. you reconcile at the
  end, with due diligence, after the suite and the updated code are
  exchanged via push/pull."* A red during the cycle is data. *"Green
  means stop"* applies at the close.
- **The close is a stop.** *"that's a stop in the cycle. i want to see the
  divergence."* Divergences are logged unresolved, the cycle halts, and
  the log goes to Andy — who either rules each one or hands it back:
  *"sometimes, sometimes i'll leave it to you both to reconcile."*
- **Every divergence entry records who settled it**, because a reading
  Andy ruled and a reading two agents agreed have different authority and
  a later session must be able to tell them apart.

**The tell:** if the close finds NO divergence, that is not a clean cycle.
On a spec written in English, worked independently, some divergence is the
expected outcome — its absence means one of us was reading the other.

**One asymmetry, stated because it cannot be removed:** these sentences
were written by the implementer. wsl-claude reads them cold, which is the
point, but he is reading *my* English and not Andy's. A divergence here is
therefore as likely to be a defect in this document as a difference of
reading, and the log should not assume otherwise.

---

## What is true before anything is written

Measured at `36406eb`, with lines, per the citation rule.

- **A relay reports to its owner over the stream, on events** —
  `relay.js:4638`, `presentNow.send(ownerKey, 'relay-status',
  relayStatus.report({…}))`, called from `ownerEvent` at `:1158`, `:1183`,
  `:1388`, `:1883` and others. **There is no timer.** A quiet relay sends
  nothing.
- **The node keeps exactly one report per relay, in memory, overwritten**
  — `presenceNode.js:382`, `statusByRelay[url] = msg.data`, commented
  *"The latest report per relay, overwritten each time, so nothing
  accumulates."* Nothing persists it. Restart the node and the history is
  gone because there is no history.
- **It is reachable already** — `hub.js:2501` hands `relayStatus` out
  through the `relay.status` verb (`server.js:1634`).
- **The stream's edges are already hooked** — `presenceNode.js:435-436`,
  `onOpen` and `onClose`, which today seed the relay, hand over the card
  and publish a line.
- **The report already carries the seat count** — cycle 9's R13 added
  `seats: { held, outstanding, allowance, free }` to
  `relayStatus.report`. This did not exist when the plan for this cycle
  was written, and it is the single most useful thing to keep a series of.
- **`node.db` exists and `nodeStore.js` owns it**, with four tables and a
  migration pattern that asks the schema what it has rather than keeping a
  version number.
- **The owner is the only recipient** — a relay sends its report to
  `ownerKey` alone (`relay.js:4638`).

---

## Andy's rulings, carried in

| | |
|---|---|
| where it lives | **on the node** — *"node-side app issue"* |
| what it is | **a database**, not a log — *"this is not user-stuff, its machine and network maintenance"* |
| who may read it | **the owner** — only an owner receives a relay's reports at all |
| why it is in the alpha | it is the instrument every tightening decision reads from |

---

### R1 — one table, owned by `nodeStore`

A `relay_record` table in `node.db`: `relay`, `at`, `kind`, then the
figures — `members`, `connected`, `allowance`, `routes`, `rssMB` — plus
**one JSON column for the rest of the report**, so a new figure in
`relayStatus` needs no schema change.

The named columns are the ones queried and ordered on; the JSON column is
everything else, kept because a figure nobody thought to name is exactly
what a later question will want.

**Verify:** wsl-claude's suite. *(Under this cycle's agreement the
assertions are his; this document states what they must hold true.)*

**Verify:** `spirit/test/relayRecord.js`, written by wsl-claude from this document without reading the implementation — the five named figures are columns queried without opening the JSON, and a figure the schema never heard of survives whole.

**Status:** DONE at `78d6e3a`.

### R2 — the node process writes it, and no job does

The node already receives every report, around the clock, on the stream
it already holds. A job would be a second writer on a file the node owns,
and a second thing to be running.

**Verify:** `spirit/test/relayRecord.js`, written by wsl-claude from this document without reading the implementation — the node process writes the record and nothing else does.

**Status:** DONE at `78d6e3a`.

### R3 — gaps are recorded, not guessed

Reports arrive on change (`relay.js:4638` via `ownerEvent`), so **a quiet
stretch and an outage are the same absence**. Without an explicit mark, a
reader cannot tell a relay that had nothing to say from a relay that was
gone.

So `presenceNode`'s `onOpen` and `onClose` (`:435-436`) each write a row,
with `kind` distinguishing them from a report.

**This is the requirement most likely to be read two ways:** whether the
open/close rows belong to this requirement or are a separate one, and
whether a gap is *marked* or merely *inferable* from the rows either side.

**Verify:** `spirit/test/relayRecord.js`, written by wsl-claude from this document without reading the implementation — the two edges sit in the series in order and distinguishable by kind; an edge keeps its INSTANT rather than its minute, so a flap does not vanish; and a close says why.

**Status:** DONE at `78d6e3a`.

### R4 — bounded, in two tiers

One row per relay per minute, kept **90 days**; then one row per relay per
day, kept **for good**. Cycle 9 bounds every persisted dataset by disc and
this is no exception.

**The daily tier is the one that matters and the reason it is unbounded**:
that curve is the evidence a growth argument is made from, and it costs a
row a day.

**The figures are proposed, not ruled.** Andy has not named them.

**Verify:** `spirit/test/relayRecord.js`, written by wsl-claude from this document without reading the implementation — one row a minute, and a day older than ninety keeps one row.

**Status:** DONE at `78d6e3a`.

### R5 — what is never kept

Invite labels. Partner names. Anything per member. Payloads.

The record is about the BOX, not about the people on it. A relay's report
already refuses to carry a member list (0012); the record must not
reassemble one by accumulation — **a series of counts is a different
object from a series of names, and only the first is machine maintenance.**

**Verify:** `spirit/test/relayRecord.js`, written by wsl-claude from this document without reading the implementation — a report carrying people becomes a record carrying counts — nine strings searched for, none found — and a name arriving as a plain string is dropped too.

**Status:** DONE at `78d6e3a`.

### R6 — one read verb, answering values

`relay.record`, owner-only, returning **a series of values and not the
table**.

0020: *"A value may cross. A structure may not."* — and its own test for
which is which: *"whether the node has already **decided** the thing. A
decided value is an answer; a row, a depth or a timer is the working-out."*

**This is the second sentence likely to be read two ways**, and it is
worth saying so plainly: a series *is* a structure by shape, and a series
of decided values is an answer by 0020's own test. The two readings give
different verbs. Neither is obviously wrong from the text.

**Verify:** `spirit/test/relayRecord.js`, written by wsl-claude from this document without reading the implementation — what crosses is a series of decided values, not rows.

**Status:** DONE at `78d6e3a`.

### R7 — the seat series, because it is what the alpha needs it for

The report's `seats { held, outstanding, allowance, free }` (cycle 9's
R13) is kept per row, so an owner can see the roll approaching what the
box can serve **before** a claim is refused.

Andy: *"our alpha shape needs to monitor member count so, that RAM
capacity can guarantee service."* The refusal at the boundary is the
guarantee; this is what stops the guarantee arriving as a surprise, and
it is the series every tightening lever in the growth plan reads from.

**Verify:** `spirit/test/relayRecord.js`, written by wsl-claude from this document without reading the implementation — and the seat figures cross as answers.

**Status:** DONE at `78d6e3a`.

---

## Conditions

### C1 — the record is NOT derived, and cannot be rebuilt

Unlike the replay index (cycle 10's R17), nothing else holds this. The
traffic log records exchanges, not a relay's condition. **Losing `node.db`
loses the history**, and no amount of care elsewhere recovers it.

That is a real property and it argues for the daily tier being cheap
enough to never prune, not for a rebuild that cannot exist.

### C2 — a relay that goes away

A relay removed from the node's configuration leaves its rows behind. They
are the record of a box that existed, and deleting them on removal would
mean the history disappears exactly when somebody asks what happened.

---

## Open for Andy

1. **The retention figures** — 1 minute / 90 days / daily for ever.
   Proposed, not ruled.
2. **Whether the read verb is owner-only by key**, as the report is, or
   whether any local client may read it because the node is the owner's
   own box.
3. **Whether R3's open/close rows are this cycle or the next.**

---

### C3 — the state the record cannot mark: its own node being down

**Found by wsl-claude while writing the suite, and it is not in any
requirement.** R3 distinguishes two states and there are three:

| | rows written |
|---|---|
| **an outage** — the relay goes, the stream closes | `close` edge, then `open` when it returns |
| **a quiet stretch** — nothing happens, stream up | none |
| **THE NODE ITSELF DOWN** | none — identical to a quiet stretch |

**The node is what writes the record, so it cannot record its own
absence.** A reader looking at an empty stretch cannot tell a relay with
nothing to say from a machine that was switched off, which is exactly the
ambiguity R3 exists to remove — removed for one case and left for the
other.

**Not fixed here, because it is a new requirement and not a defect in
these seven.** The obvious shape is a `started` edge at boot: it cannot
mark the gap as it happens, but it bounds it afterwards — everything
between the last row and a `started` edge is *"this node was not
running"*, which is a different sentence from *"nothing happened"*.

**This is the artefact the working agreement said to keep:** a test the
author added mid-cycle that the design had not asked for. It is the
record of what the design forgot, and it is worth more than the
requirements that were right.

## The state before, measured

**wsl-claude asked for the existing suite to be run against the tree
before this cycle started, and sent the results. Andy backed the ask:**
*"i do think that was a legitimate ask. log the state-before."*

**I got the order wrong** — R1 to R3 were already built when the ask
arrived. So two numbers are recorded rather than one, and what each means
is stated rather than blurred.

| | suites | green | red | awaiting |
|---|---|---|---|---|
| **before any cycle-11 code** (`d1dd409`, working checkout) | 145 | **3,066** | 1 | 1 |
| **after R1–R3** (`d51a2e2`) | 145 | **3,073** | 1 | 1 |

**The +7 is not new tests.** `cycleRequirements.js` asserts one per
requirement in `design/cycles/`, and this document added seven. No
assertion about the record exists — under this cycle's agreement the
suite is wsl-claude's and the implementer has written none.

**The single red in both is `capacityFresh` on Ubuntu**, which is
wsl-claude's re-measure to clear and predates this cycle.

### And a third number, which is the one worth keeping

A **fresh checkout** of `d1dd409` — a worktree with only the tracked
tree, which is what a stranger who clones this repository gets — runs at
**2,978 green and 12 red**.

Nine of those twelve are the lab and live suites, which need local
untracked state (`relays.json` is gitignored; a labMaster must be
running). One is the stale Ubuntu measurement. **And one was a real
defect, found only because this baseline was taken:**

`publishCapacity --check` writes LF and git checks `README.md` out with
CRLF, so on a fresh Windows clone the comparison differed on all 66 lines
and `guarantees.js` reported *"the published block and the measurement
disagree"* about two identical texts. **The guarantee that this repo's
published capacity IS its measured capacity was failing for the one
reader it exists for.** Fixed: compared without line endings, written
back in the convention the file already uses.

**That vindicates the ask.** A baseline nobody takes is a baseline that
hides this — and the 12-red fresh-clone figure is worth carrying forward
on its own, because it is what a visitor sees.

---

## Divergences at reconciliation

**One divergence, logged unresolved. The cycle stops here.**

---

### D1 — R5, and whether "never kept" reaches a plain string

**The sentence, quoted from R5:**

> Invite labels. Partner names. Anything per member. […] the record must
> not reassemble one by accumulation — **a series of counts is a different
> object from a series of names, and only the first is machine
> maintenance.**

**What Claude took it to mean.** The people in a report arrive as LISTS —
`invites`, `partners`, a roll — so the rule is about lists, and the filter
turns any array or object into a count. A name arriving as a plain STRING
is not a list and passes through. **This was not overlooked**: it is
written in the code as a named residual — *"a future STRING field carrying
a person's name passes straight through. Shape cannot see that, and
nothing here pretends it can"* — and it was sent to wsl-claude in the same
words.

**What wsl-claude took it to mean.** "Never kept" is absolute. A name in
the record is a name in the record whatever shape it arrived in, and the
daily tier keeps it **for good** (R4). His assertion feeds `ownerLabel`,
`lastClaim` and `partner` as plain strings and fails on all three. His
proposed fix: **keep numbers and booleans only.**

**It is not hypothetical.** Storing spirit-3's REAL report — read live on
2026-09-23 — the record keeps:

```
{"at":"…","owner":"Andy Flinn","mode":"keys","key":"MCowBQYD…",
 "version":"0.0.1 6b6dffa","ramLimitMB":256,"messages":0,
 "uptimeSec":340716,"partners":0,"invites":1}
```

The lists became counts. **The owner's name and the relay's key did not.**

**What each costs.**
- *Claude's reading:* nothing to change. The residual stands, and any
  future string field carrying a member's name is kept for ever with
  nothing to notice it.
- *wsl-claude's reading:* a few lines — an allow-list of numbers and
  booleans instead of a deny-list of shapes. The cost is that a future
  STRING figure worth keeping (`mode: "keys"`, `version`) is dropped
  unless named, so R1's *"a figure nobody thought to name"* stops being
  free and becomes a decision each time.

**The two readings disagree about which requirement yields.** R1 wants the
unnamed remainder kept; R5 wants people never kept. A string is exactly
where those meet.

**Suggestion, not a resolution:** keep numbers and booleans by default,
plus an explicitly named short list of strings that are facts about the
BOX rather than about people — `mode`, `version`. That satisfies R5
absolutely and keeps R1's intent for the figures that matter. It costs the
open-endedness R1 was written for.

**Settled by: RECONCILED BY THE AGENTS**, 2026-09-24. Andy saw it, and
left it to us: *"sometimes, sometimes i'll leave it to you both to
reconcile."* wsl-claude accepted the suggestion and improved it three
ways, all of which are in the implementation:

**1. The argument the proposal was missing: an allow-list fails in the
safe direction.** His words: if somebody adds a figure and nobody
classifies it, an allow-list simply drops it — a lost column, and a
column can be added back. A deny-list that forgets keeps a person's name
for ever in the tier that is never deleted, and that cannot be taken
back. **One mistake costs a column; the other is permanent.** That is a
better reason than the one offered for it, which was a balance of
requirements rather than a direction of failure.

**2. A public key is not on the list.** It identifies a person as
reliably as a name and worse, because it is exact and permanent. The
first proposal had not considered it; spirit-3's real report carries one.

**3. The record admits what it withheld, by field NAME and never by
content.** `owner` is a field name; *"Andy Flinn"* is a person. Without
this the record looks like a report that never carried those fields, and
whoever maintains the allow-list cannot see what is actually arriving to
be classified.

**What is kept now**, against spirit-3's real report:

```
{"mode":"keys","version":"0.0.1 6b6dffa","ramLimitMB":256,
 "uptimeSec":340716,"partners":0,"invites":1,
 "withheld":["at","owner","key"]}
```

**The requirement conflict remains real and is not papered over.** R1's
*"a figure nobody thought to name"* is no longer free: a new string
figure is dropped until somebody adds it to `KEEP_STRINGS`. That is the
price of R5 being absolute, it was paid deliberately, and `withheld` is
what makes the price visible instead of silent.

**wsl-claude's suite is green on both platforms** — 21 assertions — after
he fixed the two defects found at the same moment: a database handle held
open across `rmSync`, which Windows refuses and Linux allows, and 27
citations that did not name their cycle.

---

### Not a divergence, but found at the same moment

**wsl-claude's suite crashes on Windows before it reports.** `fs.rmSync`
on a temp directory whose SQLite handle is still open fails `EPERM` on
Windows and succeeds on Linux, so the suite runs green-then-red on his box
and dies at the first cleanup on mine. His code, his to fix — recorded
here because it is the first thing the two-platform arrangement caught
about the arrangement itself, and because a suite that cannot report on
one platform cannot be the independent check on that platform.
