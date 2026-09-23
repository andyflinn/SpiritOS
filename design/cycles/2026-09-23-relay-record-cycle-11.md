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

**Status:** OPEN.

### R2 — the node process writes it, and no job does

The node already receives every report, around the clock, on the stream
it already holds. A job would be a second writer on a file the node owns,
and a second thing to be running.

**Status:** OPEN.

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

**Status:** OPEN.

### R4 — bounded, in two tiers

One row per relay per minute, kept **90 days**; then one row per relay per
day, kept **for good**. Cycle 9 bounds every persisted dataset by disc and
this is no exception.

**The daily tier is the one that matters and the reason it is unbounded**:
that curve is the evidence a growth argument is made from, and it costs a
row a day.

**The figures are proposed, not ruled.** Andy has not named them.

**Status:** OPEN.

### R5 — what is never kept

Invite labels. Partner names. Anything per member. Payloads.

The record is about the BOX, not about the people on it. A relay's report
already refuses to carry a member list (0012); the record must not
reassemble one by accumulation — **a series of counts is a different
object from a series of names, and only the first is machine maintenance.**

**Status:** OPEN.

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

**Status:** OPEN.

### R7 — the seat series, because it is what the alpha needs it for

The report's `seats { held, outstanding, allowance, free }` (cycle 9's
R13) is kept per row, so an owner can see the roll approaching what the
box can serve **before** a claim is refused.

Andy: *"our alpha shape needs to monitor member count so, that RAM
capacity can guarantee service."* The refusal at the boundary is the
guarantee; this is what stops the guarantee arriving as a surprise, and
it is the series every tightening lever in the growth plan reads from.

**Status:** OPEN.

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

## Divergences at reconciliation

*Empty until the close. Entries are logged unresolved: the sentence
quoted, what each side took it to mean, what each costs, and a suggestion
— then **settled by Andy** or **reconciled by the agents**, appended
rather than replacing what was recorded.*
