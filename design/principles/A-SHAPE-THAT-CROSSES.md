# A shape that crosses is made by a factory, and the factory is the only door

*Ruled by Andy, 2026-09-25, across four sentences. Every claim below
carries `path:line` verified at `9a3988f`, and the measured results were
run rather than reasoned. Decided and open are kept apart: a third party
should be able to act on this without re-deriving it.*

---

## The rule, in his words

> *"so any object that can get passed around, posted or received must be
> of a shape from a factory, that can validate those object types in
> themselves?"*
>
> *"and it has serialize/deserialize"*
>
> *"and neither serialize nor deserialize succeed if the data is not
> valid."*
>
> *"a dialog-form needs to manipulate until the data is validated."*

Four sentences, and each adds something the one before it does not.

**AND IT GOVERNS OBJECTS THAT NEVER CROSS ANYTHING.** His words are
*"passed around, posted or received"* — **passed around** covers objects
that never reach a door at all, in-process, between modules on one box.
So this is a principle rather than protocol, and `THE-DOOR.md` is a
CONSUMER of it rather than its home. The test (wsl-claude's, for
`INDEX.md`): would this still be true and useful on a project with no
relay in it? Entirely. *Said here because the first reader will assume
protocol and file the next one in the wrong place.*

---

## Why a factory and not a description

The question it answers came from wsl-claude, 2026-09-25, while costing
argument descriptors for the door:

> **AN ARGUMENT DESCRIPTOR THAT IS A SECOND STATEMENT ABOUT A HANDLER IS
> A REMEMBERED FACT.** It must be the thing the handler VALIDATES WITH,
> not a declaration beside it.

A factory satisfies that **by construction**: the thing that makes the
object is the thing that checks it, so there is no second statement to
drift from a first.

**THIS IS NOT THE TYPE SYSTEM THAT WAS DELETED**, and the difference is
the whole point. `design/archive/TYPE-SYSTEM.md` — *"built and then
deliberately deleted from kernel.js — a genuine simplification, not an
oversight"* — was **schema as data**: type definitions stored as JSON
with per-field `readonly` / `immutable` / `serveronly` / `nopersist`
flags, sitting in a registry BESIDE the objects they described. That is
precisely the remembered-fact arrangement. A factory is the opposite one.

**The discipline that keeps it from becoming the archived thing is one
line:** the shape lives in the factory's CODE, and the factory is the
only way to make the object. A definitions file that a factory consults
is `TYPE-SYSTEM.md` back from the archive wearing a constructor.

---

## The pattern exists, once, and it works

`spirit/run/js/client/packet.js` is a factory with serialise and
deserialise, and it bounds at serialisation. Measured, not read:

```
packet.encode('fixList', { text: 'x'.repeat(20000) })
  -> { ok: false, error: 'packet too long: 20095 of 16384' }
packet.encode('fixList', { text: 'small' })
  -> { ok: true }
```

**And it carries the scar that proves the design.** `packet.js:64-67`
records what happened when the bound was a second statement:

> *"IT SAID 1024 AND THE RELAY SAID 16384 — the same measurement of the
> same string, disagreeing by 16×, with this comment claiming to mirror
> a number it undercut. Every app was capped at a sixteenth of what the
> relay would take. **One rule, one place: js/limits.js.**"*

That is the failure this rule prevents, in this codebase, already paid
for once.

---

## What it subsumes, and the half it does not

**THE FACTORY OWNS THE SHAPE. THE VERB OWNS THE CONTENT.** That line
decides every row below, and an earlier draft of this table got it wrong
in the direction that would have hurt.

| was | becomes |
|---|---|
| the hard CEILING on a response, and its measurement (`PUPPETS.md` G1, mechanical half) | the factory's serialise — one place that knows the size, which is exactly the 1024-versus-16384 scar |
| argument descriptors for the door | **derived** from the factory rather than declared beside it |
| the door describing itself | the same artifact again |
| **truncate, rank, and flag partial (G2)** | **NOT SUBSUMED. Still its own thing.** |

**Why G2 survives, in wsl-claude's words, 2026-09-25:** *"A factory can
refuse an object that is too big. IT CANNOT DECIDE TO RETURN FIFTY
CONTACTS OF TWO HUNDRED, RANK THEM, AND SAY THERE ARE MORE. That is a
decision about the answer's CONTENT, and content is the verb's, not the
shape's."*

`THE-REQUESTER-IS-RESPONSIBLE.md:127` asks for *"bounded, ranked and
truthful about being partial"*, and `:146` says it is *"not a licence to
refuse rather than fix"*. **A factory alone gets us back to
`answer-too-large` by a nicer road** — the refusal branch this project
rejected once already, which a caller can do nothing with. Retiring both
rows would lose the thing the principle actually asks for.

None of what IS subsumed needs a build step, a type registry, or
reversing a deliberate deletion.

---

## The third sentence, and the gap it exposes

*"neither serialize nor deserialize succeed if the data is not valid"* is
the strong form: it makes an object's EXISTENCE the proof, so nothing
downstream re-checks.

**Encode already meets it. Decode does not.** Measured:

```
packet.decode('just a message')
  -> { legacy: true, app: null, body: 'just a message' }
```

`packetDecode` (`packet.js:250`) classifies rather than refuses — hand it
anything and an object comes back.

The reason is real: plain chat text genuinely is not an envelope. But
under this rule that is **not a lenient branch, it is a second factory
nobody wrote**. And `legacy: true` is the tell — a remembered fact about
an object's ORIGIN, carried inside the object, because the object could
not simply be of a known kind.

The cost lands downstream: both puppets re-ask what arrived, each in its
own words (`if (!note || note.app !== APP) return`). Two re-statements of
a question a factory would have answered once.

**So one concrete consequence in existing code: `decode` splits.** An
envelope factory that refuses non-envelopes, and a message factory for
text that was never one. Nothing else in `packet.js` changes.

**And it is cheaper than it looks.** wsl-claude measured what depends on
`legacy: true` today: `.legacy` is read on **one** production line —
`packet.js:282`, inside `packetDecorate` — and `packetDecorate`'s
production caller was itself deliberately removed
(`arrivals.js:173-183`, Andy: *"nothing in node and relay should know
about apps"*).

**THE ONE TRAP, AND IT IS THE WHOLE OF THE ATTACK ON THIS RULE: A
REFUSAL IS A VALUE, NOT A THROW.** *"Neither serialize nor deserialize
succeed"* must not become "deserialize throws". Every booted app sees
every admitted arrival and filters for its own (`nodeApps.js`), so
somebody else's ordinary mail is the NORMAL case at every app's front
door.

**And it is common BY RULING, not by accident.** Every booted puppet is
subscribed to every admitted arrival because **the node routes nothing**
— Andy: *"nothing in node and relay should know about apps."* So the
fan-out is a deliberate choice and somebody else's mail is its permanent
consequence, not an artefact of there happening to be two apps. *Said
here because a later reader may otherwise try to fix the volume by
routing at the node, which trades this problem for the one he already
refused.*

If `decode` threw:

- every app's arrival handler would wrap its filter in try/catch
- the normal case would become an exception
- and a genuinely malformed packet would be indistinguishable from
  somebody else's perfectly good one

A refusal VALUE — `{ ok: false, ... }`, the shape `spiritErrors` already
uses everywhere — satisfies the rule exactly: deserialise did not
succeed, the caller is told so, and nobody is catching the weather.

---

## And a bound must not arrive before a meter

**A BOUND APPLIED BEFORE A METER CONVERTS A WRONG ANSWER INTO A BIG
ANSWER, AND THE EVIDENCE OF THE WRONGNESS IS THE PART IT DISCARDS.**

Found by nearly doing it. The return bound was going to be built first;
wsl-claude argued the meter should come first because nobody had derived
which verbs return collections. The meter then measured `jobs.list`
through the real door on an idle node:

```
207,199 bytes.  Three rows.
row 0  205,731 bytes -- data=205,539  log=53  createdAt=13
```

**99.2% of the answer is one job's `data`**, and that job is `fs-watcher`
(`jobs.js:141`, `createJob('permanent', 'fs-watcher', { files: files })`)
whose `data` is the whole file index. `jobs.list` is
`Array.from(jobsMap.values())` — every job entire, internals included.

Had the bound landed first, that answer would have been truncated to the
limit and flagged partial, and **a verb returning the file index would
have looked like a big answer rather than a wrong one.** The 190KB the
bound discarded is the entire evidence that anything was wrong.

It generalises past size: **any normaliser applied before measurement
does this** — a mechanism that makes a symptom comfortable and takes the
diagnosis away with it.

*The same file shows the right shape eight lines from the wrong one:
`jobs.js:266-269` derives a tally FROM the in-memory list — "no extra
filesystem I/O, just tallying what it already scanned" — which is a
decided value rather than the working-out. The door is not missing the
pattern; one verb is not using it.*

**And this is already shipping.** Not a risk that arrives with scale: an
idle node on a real tree answers 207KB today, and any consumer over a
packet already cannot have it.

---

## The fourth sentence, and what it costs

*"a dialog-form needs to manipulate until the data is validated."*

**A form holds a DRAFT, not an object.** It asks the factory whether the
draft is valid yet; the object comes into existence only when it is. The
rule stays intact — if you are holding one, it was valid — and a
half-filled form is input rather than a broken object.

**Which makes the factory what the form validates WITH**, so the error a
person reads is the factory's refusal rather than the form's own
restatement of the rules. A form that says *"name must be 1-63
characters"* in its own words is the same drift in the least visible
place, because both halves look right in isolation.

**AND THAT ADDS A REQUIREMENT THAT IS NOT FREE.** A refusal must say
WHICH PART, or a form cannot point at anything. Today a refusal is a
sentence: `{ ok: false, error: 'packet too long: 20095 of 16384' }` —
enough for a whole-object bound, useless for a field.

So a factory's refusal wants three things:

- **a code**, from `spirit/run/js/spiritErrors.js` — the closed set
  already exists, and G9 (`appServerBoundary.js:493`) already insists
  every refusal be a member of it
- **the field** it is about
- **the sentence**, which the form renders

The form shows the field and the sentence; a program branches on the
code; a caller in another language gets the same three. **The cost is
that refusals stop being strings**, which touches every factory written
from here and the one that exists.

---

## OPEN — not ruled, and not to be built under

- **How many shapes cross the door.** Nobody knows. wsl-claude's meter
  (`PUPPETS.md` G3) produces the count as a side effect: its per-verb
  split — refused-for-a-missing-body versus threw — is the list of
  shapes that would need a factory.

  **AND THE NUMBER IT PRODUCES IS A FLOOR, NOT AN ESTIMATE.** A verb walk
  finds only the shapes that are a VERB'S ARGUMENT. A shape that crosses
  inside a body — a packet body, an app's own payload, anything nested —
  is invisible to it. So the reading scopes the door's half honestly and
  says nothing about the rest, and it must be quoted as *"how many verbs
  want one"* rather than *"how many shapes cross"*. (wsl-claude's
  boundary, stated before the reading exists so the floor cannot quietly
  become the estimate.)
- **What the rule costs.** Andy has ruled the rule; nobody has ruled its
  price, and the two should not be confused. The meter's reading is what
  turns "every crossing object" from a sentence into a number.
- **Whether `PUPPETS.md` G1's row should SHRINK into this** — its
  ceiling and measurement move to the factory; its truncate-rank-flag
  half does not, and G2 stays whole. That is a board change and it wants
  the meter's reading first.
- **When this does get a board, its entries must be DERIVED from the
  reading rather than transcribed from it.** "Seventeen verbs want a
  factory" written by hand is the five-verbs error again; the count
  comes out of the meter on every run. *(wsl-claude, 2026-09-25.)*
