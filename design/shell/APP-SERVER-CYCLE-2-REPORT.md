# Cycle 2 — the app server build: reconciliation stop and report

**Stopped 2026-09-24 at Andy's word** — *"proceed with reconciliation,
tell me the result"*. This is the cycle-report rule 15 requires to
accompany a stop.

**The cycle ran the working agreement properly for the first time:** the
suite was written from the document by wsl-claude, the source by Claude,
and **neither read the other's artefact until this stop.**

---

## Harness

| | |
|---|---|
| **150 suites, 3161 green, 8 red, 4 awaiting** | at `a942243` |
| the 8 red | all in `appServerBoundary.js` — assertions on what is not built |
| the 4 awaiting | cycle-10/R13, cycle-11/C3, and **G8 and G10, deliberately** |

**Two are awaiting by choice rather than by omission**, and both are
disciplines worth keeping:

- **G8** — wsl-claude asserts nothing about it, because *"a name this
  agent invented would BE the divergence rather than find one."*
- **G10's fingerprint ingredients** — *"a number measured inside an
  unruled container gets quoted after the container changes."*

---

## The divergence log — 2 of 8 red, from INDEPENDENTLY-WORKED HALVES

**Written in that form deliberately.** The design sitting's zero came
from a negotiation and meant *we talked everything through*. This one
came from two agents who did not read each other until the stop, so the
number means what the count was invented to measure.

### D1 — posture: refused at load, or refused per request?

- **wsl-claude asserts:** a non-strict app is refused **at start** —
  `start()` throws, or `state()` carries the refusal.
- **Claude built:** refusal **per request** — it listens, and answers
  every request `500 app-not-strict`.

**Both readings are defensible.** Claude's position, recorded rather than
conceded: **wsl-claude's is better**, because G15 already settled that an
unsuppliable member is *"refused AT LOAD with the member named, never at
the moment the app reaches for it"* — and posture is the same shape, so
the author failed to carry his own principle across his own requirement.

**It goes to Andy unresolved anyway.** A divergence settled by the author
agreeing teaches nobody anything.

### D2 — G3, and it resolved into a SCOPING DEFECT

- **Claude classified:** not built. `ask` has no shared home yet, so the
  sample had no shared `ask` to call.
- **wsl-claude asserts** its second half separately: *"no fourth copy is
  written"* binds this cycle's new code whether or not the first half
  exists. `starter.html` ships a raw `fetch('/api/spirit')`, making four.

**The resolution is neither reading:** **G3 must be built BEFORE the
sample, or the sample necessarily violates it.** Neither agent saw that
when the cycle was scoped. That is an ordering constraint on the cycle,
not a fault in either half — **and it is the most useful thing this
reconciliation produced.**

**The aggravating fact is the author's:** a raw fetch in the artefact
every stranger copies **does not add one caller, it teaches the habit.**

---

## What was built, and driven

`G1` third startup module, dispatched before any node code · `G2` one
app, whitelist, `noindex`, loopback, 404 on traversal · `G6` the bind,
pinned by **key** never URL, first bind final, contradiction kept —
**proven live against `spirit.andyflinn.com`** · `G7` role derived on
every ask, fails closed · `G9` seven refusals in `spiritErrors`,
classification handed to the catalogue · `G10` four box fields, no
opinion field, fingerprint a named seam · `G12` `app-state/` separate
from `app/`, identity from the one identity writer · `G14` the manifest
contract, with *absent means nothing* genuinely enforced · `G15` the
named interface

**Plus `peerPostWiring.js`**, a gate that did not exist when the cycle
opened, built because Andy asked *"so we again have multiple
implementations of peerPost()?"*

## What was not built

`G11`'s four states reachable from outside · `G13`'s acceptance runs ·
`G3` and `G4` · a declared member that does not exist is not refused at
load · utilities are **parsed and never granted** · the owner-asleep
refusal never reaches HTTP · `G10`'s owner-side label minting, which Andy
ruled IN

**THIS CYCLE CLOSES WITHOUT ITS OWN ACCEPTANCE TEST HAVING RUN.** G13 is
the acceptance test, and it did not run. Said plainly rather than letting
eight red read as by-design.

---

## What the reconciliation found that neither half knew

### The author believed a false finding about his own code

wsl-claude's suite reported *"the pin was emptied by meeting the
impostor"*. **He then read the disc instead of repeating the sentence**,
found `config.json` intact, and corrected his own suite with the false
wording quoted in the comment.

**The author had his own proof that "kept" worked** — he had driven it
through `pin()` hours earlier — **and believed the suite over his own
measurement, reporting it to Andy as a serious defect without
reproducing it once.**

### And the real finding is sharper than either account

**The pin is safe on disc and the PROCESS GOES BLIND.** After meeting an
impostor: `boundKey ""`, `relay ""`, and it reports **"no relay
configured"**.

Three costs, the middle one expensive:

- the impostor is correctly not obeyed;
- **"no relay configured" is FALSE, and it is the sentence an operator
  acts on** — it sends them to pass `--relay` again, which is the one
  thing that cannot work;
- the server is **down** rather than serving the relay it is still
  pinned to.

`app-relay-key-changed` exists in the catalogue and is **not** what comes
back. **A server meeting an impostor must keep serving the relay it is
pinned to and report the conflict, not go dark.**

### Seven defects in the suite half, found before reporting

wsl-claude found and fixed seven in his own half before any of it reached
the author — **the worst being an empty cupboard: all four worlds ran an
app server with NO APP DEPLOYED, which looks exactly like a feature being
unbuilt.**

**Unchecked, at least four of the eight red would have been his**, and
the author would have spent the evening fixing correct code. That is the
strongest argument for rehearsing a world before relying on it that
either agent has produced.

---

## What could not be done, and why

- **`G11` and `G13`** — the sitting turned to the rules mid-way through
  verifying the first recipe, and did not turn back.
- **`G10`'s owner side** — ruled in, and nothing built it.
- **Three items remain unruled by Andy** and a builder would stop on
  them: the `MemoryMax` two-writers hole, how units on a box are counted,
  and the fingerprint's ingredients.

**And an honest word about where the time went.** This cycle spent more
of itself on **the rules** than on the build. Six forks were found, five
of them the author's, and every one from outside him — two by Andy in one
line each. The rules gained the fresh-reader finding, the condition every
requirement passes, the brainstorm, rule 11c, and a named drift in how
both agents were reading *attention is the constraint*.

**That was the right trade while Andy was in the room** — he was the
scarce input and the corrections were load-bearing. **The source half is
behind where it would otherwise be, and that is a fact rather than a
by-design.**

---

## ADAPTATION — proposed as a condition of closing

**Andy made this the condition:** *"propose the neccessary adaption of
cycle sequence and/or configuration as condition to closing this cycle.
record the fallout and plan adaption."* **So the cycle does not close on
the report. It closes when the cycle itself has been told how to
change.**

### The fallout, recorded before the remedies

| what happened | what it cost |
|---|---|
| `G13`, the acceptance test, never ran | the cycle closes unable to say whether its own boundary works |
| `G3` and the sample scoped with no order between them | the sample **necessarily** violated `G3`; a raw `fetch` now sits in the artefact every stranger copies |
| the cycle spent more of itself on the rules than the build | the source half is behind, **and no mechanism saw it happen** |
| a finding about the author's code was believed without reproduction | a false defect was reported to Andy and had to be withdrawn |
| four worlds ran with no app deployed | caught by their author; **unchecked, four of eight red would have been his** |
| the interface was named only because the suite's author asked | had he not, every behavioural assertion would have been red for a reason that was not a defect |

### S1 — a requirement the consumer must obey is built BEFORE the consumer

**D2 generalised.** The scoping step must **order requirements by
dependency**, and the dependency that matters is *"X constrains Y"* as
much as *"X is needed by Y"*. `G3` and the sample had no order between
them, so the sample was written first and could not comply.

### S2 — the acceptance test cannot be last, because last is what does not happen

`G13` was the exit condition and it was scheduled at the end, so the
first interruption removed it. **Any cycle that schedules its exit
condition last will skip it**, and cycles get interrupted.

**Proposed:** the acceptance test's **world** is built first — which
wsl-claude did unprompted — and **the test itself is the cycle's exit
condition rather than its last task**, so *closed* and *the acceptance
ran* are one fact instead of two.

### S3 — nothing noticed that the cycle stopped building

**This is the important one and it has no remedy yet.** The cycle became
a rules cycle, and **no mechanism saw it**: not the board, not the
report, not either agent. A cycle can be displaced entirely and still
look busy.

> **CORRECTED BY ANDY AT THE CLOSE, and it changes what S3 IS.** *"i
> forced it to happen, because i noticed drift. this is ok, from my point
> of view."*
>
> **The drift was steered, not accidental.** He saw it and caused it. So
> nothing failed here — **he was the mechanism**, which is the same
> finding as everywhere else in this cycle: the reader without the answer
> in his head, arriving at the right moment.

**The gap that remains is narrower and real: it only bites UNATTENDED.**
While Andy is in the room, drift is steered and visible to him. In a long
autonomous stretch — which is where this project is heading — nothing
would compare *what the cycle is doing* against *what the cycle was for*,
and the stop would report it **only because the author chose to say so.**
A rule that depends on the author confessing is *the check that cannot
fail*.

**No proposal is offered rather than a weak one invented.** Put to the
other agent for a mechanism, scoped to unattended cycles.

### C1 — the interface is named in the DESIGN, not discovered at build

`G15` exists only because the suite's author asked for five names before
writing three hundred lines. **Any cycle that splits suite from source
needs its interface named as a requirement, not as a favour** — or
every behavioural assertion is red at the close for a reason that is not
a defect.

### C2 — a world asserts its own preconditions

wsl-claude's finding, in his area, and stated because **the failure is
indistinguishable from the thing being measured**: an app server running
with no app deployed looks exactly like a feature being unbuilt. A world
must prove it is the world before it proves anything about the code.

### C3 — a finding about the other half is reproduced by its OWNER before it goes upward

**The author's fallout.** He held his own proof that *kept* worked,
believed the other half's suite over his own measurement, and reported a
false defect to Andy without reproducing it once. **The existing rule —
report what you CHECKED — did not reach the case of a finding about
somebody else's code.**

---

## THE ADAPTED IMPLEMENTATION PLAN — agreed by both agents

**Andy, closing:** *"considering this the status quo, and changing
adapting the implementation plans with recognized dependencies etc...
before updating the brain and going idle for the next 'go'."* And:
**"new plan must be agreed to by wsl."**

**Agreed, with four refusals, all taken.** The carried-forward list is
not a list any more — it is an **order**, built from dependencies this
cycle discovered rather than the order the requirements happened to be
written in.

| # | what | why it sits here |
|---|---|---|
| **1** | **G16** — a server meeting an impostor keeps serving its pinned relay and reports the conflict; every refusal reaches HTTP carrying its code | **blocks 7.** Two of the four states cannot be OBSERVED until a refusal carries a code and a mismatch stops blanking the pin |
| **2** | **G3** — `ask` gets one home | **blocks everything touching the sample** (D2) |
| **3** | the starter moves onto the shared `ask` | clears D2's violation. **Finish before 7 BEGINS** — not merely before it ends |
| **4** | **G4** — `app/shell` offers elements and tokens as files | **blocks 5.** Utilities cannot be granted from a folder that does not exist |
| **5a** | **SETTLED:** refuse a missing member at load; grant utilities | G15 says it, both agents agreed it. Build it |
| **5b** | **UNRULED — D1, posture at load vs per request. BLOCKED ON ANDY** | written apart from 5a **on purpose** |
| **6** | **G11** — the four states driven from outside, against the post-item-3 sample | needs 1, and 5b settled |
| **7** | **G13** — the acceptance runs. **THE EXIT CONDITION** | needs 3 and 6 |
| **8** | **G10**'s owner-side label minting, **plus one assertion that something reads the label back** | ruled in by Andy |

### The four refusals, and why each changed the plan

*(Numbered REFUSAL rather than R, because a bare R-number in this tree
means a cycle requirement — twenty of them are defined by more than
one cycle, and `cycleCitations` refuses an unqualified one. It caught
this file on the commit that introduced it.)*

**REFUSAL 1 — the plan had no slot for the divergence it was sending to Andy.**
Posture goes to him unresolved and **nothing in the nine items touched
it**, so *"mid-cycle we meet a ruling with no slot to put it in, and
whoever is holding the work decides on the spot — which is how a
divergence gets settled quietly by whoever got there first."* It is
**5b** now, blocked, and **written apart from 5a** — because the settled
half sits one line away and *"the second gets built on the momentum of
the first."*

**REFUSAL 2 — item 3 modifies the sample; G11 says the sample UNMODIFIED.** Fine
as ordered, but the four states must be driven against the post-item-3
sample, and his worlds deploy whatever is in `app/starter` at run time.
So **3 finishes before 6 begins**, rather than overlapping.

**REFUSAL 3 — item 8 would write a label nothing reads.** The owner interface
that would consume it is deferred, so a minted label has no consumer this
cycle — which is *declaring is not granting* arriving against its own
author. It carries **one assertion that something reads it back**; if
nothing in the cycle can, **that fact goes in the report where Andy can
see what he ruled in**, rather than being found next cycle as an empty
field.

**REFUSAL 4 — item 1 is a defect fix and it is first, and the cure is to stop
calling it a defect fix.** It is **G16** now, with an id and a status.
*"A defect fix that is not a requirement is INVISIBLE TO EVERY INSTRUMENT
WE HAVE — no board row, no status, no citation. That is S3 at
requirement scale, and we should not reintroduce it one level down on the
first item of the new plan."*

### And S3's meter is corrected before adoption

**wsl-claude refused his own mechanism.** This agent had called *"the
meter would have been reading red on us for the last hour"* the strongest
thing that could be said for it. **It is also the defect:**

> *"EVERY cycle ends in a stop, and every stop produces out-of-scope
> commits — the report, the rules, the plan, the brains. So a tail-run
> signal fires at the end of every cycle that ever existed, including
> cycles that built their scope perfectly. I built a meter that is red by
> construction at the only moment anyone reads it."*

**The fix is not a threshold. The run is measured up to the moment the
STOP IS CALLED**, which is a declared event — Andy says *proceed with
reconciliation* — so the boundary is a fact and not a judgement.
Everything after it is close-work and is expected to be out of scope.
**The question the meter asks is whether the cycle stopped building
BEFORE anybody called the stop.** Ours did, by two and a half hours.

**And the scope declaration must include the cycle's own design
document**, or a future cycle reads as displaced while doing the most
in-scope thing there is.

**BLOCKED ON ANDY, and a builder stops on each:** 5b (the posture
divergence), the `MemoryMax` two-writers hole, how units on a box are
counted, and the fingerprint's ingredients.

---

## Carried forward

`G3` **before** any further sample work (D2's ordering constraint) ·
`G4` · `G11` and `G13`, the acceptance test · `G10`'s owner side · the
go-blind defect in `settleRelay` · refuse-at-load for a missing member ·
granting utilities rather than only parsing them · surfacing the
owner-asleep refusal to HTTP
