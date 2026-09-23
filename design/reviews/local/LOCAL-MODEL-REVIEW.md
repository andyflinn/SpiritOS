# What a local model is good for, measured on a night of it

**Written 2026-09-23, from the run in `2026-09-22-night.zip`.** Decided by
Andy: *"we need to log our assessment of what the local ai is usefull for,
and find jobs it can do, that help. smaller scope, much lower reasoning."*
And on what happens next: *"then we let it rest until core is at that
alpha level."*

> **THE FIRST VERSION OF THIS PAGE UNDERCOUNTED THE RUN BY A FACTOR OF
> SEVENTEEN** — it said 14 findings in 3 files. The real figure is **242
> findings across 44 of 47 files**. The grep behind it anchored on a
> bracket at the start of a line, and most files number their findings
> (`1. [REGRESSION] …`), so only the flat-formatted files were counted.
> Corrected here rather than quietly fixed, because the original number
> was used to argue that the run was nearly worthless, and that argument
> was built on a measurement error of my own.

## What was run

wsl-claude drove **gpt-oss:120b through Ollama**, on the 5060 Ti, over
**47 files** of `spirit/run/js`. It ran **16:16 to 07:55 — fifteen and a
half hours** unattended, and it finished. Larger files were cut into
slices: `relay.js` took 85 minutes across six, `hub.js` 47 across four.

The output is in the zip: one markdown file per source file, a progress
log, and the run's stdout and stderr. **Kept whole rather than
summarised** — the point of a measurement is that somebody else can check
it.

## What it produced

**242 findings across 44 of 47 files.** Only `lever.js`, `relayDump.js`
and `streamSink.js` came back clean.

| | |
|---|---|
| `[REGRESSION]` | 124 |
| `[DESIGN]` | 118 |
| `[UNVERIFIED]` | 10 |

**This has NOT been triaged.** What follows is a sample, deep enough to
answer "what is this good for" and nowhere near enough to say what is in
the other two hundred. **Triaging it properly is a real job and it is on
nobody's list.**

## Did it understand the task? — Yes, and better than expected

- **The format held for fifteen hours and 47 files.** Tag, `where:` with
  file and line, `why:`, `fix:`. It did not drift, truncate or start
  free-associating in hour twelve.
- **It invented a third tag and used it correctly.** `[UNVERIFIED]`, ten
  times, for claims it could not settle from one file: *"Presence of this
  module in the `oneDoor.js` census cannot be confirmed from the file
  alone."* A model that marks its own uncertainty is doing something
  qualitatively better than one that does not.
- **It read `AGENT.md` and applied it.** Not generic linting: it cited the
  no-`EventSource` rule, the `oneDoor` census requirement, and a
  read-only-file rule, by name.

## Did it understand what we are trying to achieve? — Partly, and shallowly

**It applied the rules it was handed. It did not reason from what they are
for.**

- **It never cites a decision, a principle or the vision.** Not one
  reference to a numbered decision, to `NODE-AND-RELAY.md`, to
  `PARTNERS.md`, to "a relay keeps nothing". `AGENT.md` appears six times;
  nothing else does.
- **Its vocabulary is generic web security** — validate (26), sanitize
  (6), race condition, memory leak, DoS, injection. That is the corpus
  talking, not this system.
- **It cannot see across files, and does not always know it.** It filed
  `kernel.js`'s `new EventSource('/api/events')` as a `[REGRESSION]`
  against `AGENT.md`. The letter is right — and `oneDoor.js` records that
  kernel.js is *"the other side of the same rule rather than an
  exception"*, a counted, decided case. A reviewer holding one file cannot
  know that. **To its credit it hit the same wall elsewhere and said so**,
  which is what `[UNVERIFIED]` is.
- **It reasons from shape when it cannot reason from the whole.**
  `reconfigure` "leaks detailed system metrics **if the endpoint is not
  strictly admin-only**" — it is owner-gated, and the model guessed rather
  than followed the gate.

## The failure that matters most: it fabricates

Two sampled findings are not misreadings but **inventions**:

- **`PARTNER_QUILT_MS`.** It reported a typo causing a `ReferenceError`
  that would break partner availability, at `relay.js:1195`. **That
  identifier does not exist in the file.** The code reads
  `PARTNER_QUIET_MS`, correctly, at every one of its seven occurrences. It
  invented a misspelling and then reasoned confidently about the crash it
  would cause.
- **`fitsWrapped` ignores the wire overhead.** It does not: it builds the
  wrapper the relay would build and measures that, and the comment above
  it says so in as many words. The model asserted the opposite.

**A wrong finding costs more than a missing one.** A miss costs nothing
until something breaks; a confident fabrication costs a person reading
code to disprove it, and it looks exactly like the true findings beside
it.

## And it did find real things

- **`readAll` loads the whole permanent traffic log into memory** on every
  read — `readFileSync` plus a split, on a file Andy has ruled is kept for
  ever. Real, unbounded, and nobody had said it.
- **`rateOk` only prunes empty buckets above a sweep threshold**, so dead
  keys below it are never cleaned.
- **The `kernel.js` EventSource tension** is real; it is simply already
  decided.

**One real finding per sampled handful, at fifteen hours a run.** The
signal is there. The cost is in separating it.

## THE COST IS NOT THE NIGHT — ANDY'S CORRECTION

> *"remember if 6 hours tittering away only cost me a little bit of
> power....."*

The first version of this page reasoned from **fifteen hours for one
sampled finding**, as though the hours were the price. They are not. The
GPU is already in the room, the night is already dark, and the electricity
is pennies. **The scarce resource is the attention it takes to separate a
true finding from a confident false one** — and that is spent by a person
or by a better model, both of which cost more per minute than the 5060 Ti
costs per night.

**So the thing to optimise is triage cost, not run time.** A run may be
extravagant, repetitive, even mostly wrong, as long as what comes back is
cheap to check. That inverts the earlier advice: the question is not "is
this job small enough for the model", it is **"is the output of this job
mechanically checkable"**.

## AND THE PACKAGING IS PART OF THE JOB

> Andy: *"it produced to man files. i kind of thinks the result delivery
> should be packaged more conveniently, if that model has any use....."*

**47 output files for 47 source files is the model's convenience, not the
reader's.** Nobody opens 47 files. What a night should return is **one
digest**: every finding in one document, ranked, with the low-confidence
ones below a line, so that reading it is one pass and not a directory
walk. The per-file detail can stay underneath for anyone who wants it.

That is not a presentation nicety. Output shaped for the reader is what
makes the triage cheap, and triage cost is the whole price.

## THE GATE THAT CHANGES THE VERDICT

**Fabrication was the disqualifying failure, and it turns out to be
mechanically detectable.**

Look at what the model actually wrote about the typo it invented:

> *"`partnerLive` returns `!(missed && now - missed < PARTNER_QUILT_MS)`,
> but the correct constant is `PARTNER_QUIET_MS`."*

**It quoted the line — with its own typo substituted into the quote.**
The real line 1227 reads `return !(missed && now - missed <
PARTNER_QUIET_MS);`. The model paraphrased-and-corrupted rather than
copying.

So a single mechanical pass kills it: **for every finding, check that the
quoted source actually appears at the file and line named.** The quoted
string `PARTNER_QUILT_MS` appears nowhere in `relay.js` — one grep, zero
human attention, finding rejected before anybody reads it.

**The run is already 80% of the way to supporting that gate**: 233 of the
242 findings carry a `file:` or `where:` reference, and 190 quote
backticked source. The format needs one change — **quote verbatim, never
paraphrase** — and then a script can pre-verify every claim and drop the
ones that reference code that does not exist.

**With that gate, review comes back onto the table.** The reason to rule
it out was that a confident wrong answer is indistinguishable from a right
one. It is distinguishable if the model must show its evidence and a
script checks the evidence is real.

## So what to give it instead

Jobs with **small scope and low reasoning**, where being wrong is
**visible rather than plausible**:

- **Breadth sweeps for one checkable pattern.** Every file that reaches
  for `fetch`/`EventSource`; every caller of a deleted function; every
  route with no caller. The answer is a list of `file:line` that `grep`
  settles in seconds. **Breadth is exactly what a night buys**, and
  verification is free.
- **First drafts for somebody else to cut.** The door contract is the
  standing example and an alpha deliverable — the verb list, the error
  codes, the size and rate limits, drafted out of `verbTable.js` and
  `spiritErrors.js`. Wrong drafts are cheap; wrong reviews are not.
- **Vocabulary sweeps after a rename** — everywhere `census` survived in
  any form. Mechanical, exhaustive, grep-checkable.
- **Reformatting and translation** — a table into prose, a log into a
  digest, one JSON shape into another.
- **Bulk classification into buckets we supply**, where it chooses from a
  fixed list rather than inventing the categories.

And **not**: security review, protocol reasoning, or anything where a
confident wrong answer is indistinguishable from a right one — which is
most of what a review is.

## The best overnight job on the list: DEAD CODE, because the harness is the verifier

Andy: *"dead-code sweeps?"* — and it is the sharpest candidate, for a
reason that has nothing to do with the model being good at it.

**We already own the verifier.** Delete a candidate, run the harness, and
3007 assertions answer in four minutes. A model that fabricates is
*harmless* against a check like that: it proposes, the harness disposes,
and a wrong proposal costs one run rather than a person reading code to
disprove it. Nothing else on the list has a verifier that cheap.

It is also genuinely night-shaped — breadth is the entire value, and the
answer is a list of `file:line`.

**Where the model earns its keep is exactly what a script cannot do.**
A 40-line cross-reference finds uncalled exports (see below); it cannot
see that this tree reaches dynamically almost everywhere — verbs
dispatched by name, apps by manifest, jobs spawned by path, handlers by
string — so a naive sweep will confidently propose deleting live code. Nor
can it read the comment above a function explaining why it is kept. Both
are reading jobs, and reading is what the model is for.

**Candidate generator, never authority.** Nothing is deleted until the
harness has run without it.

## And the same shape answers the opaque-interface rule

Andy: *"could it verify that implementations expose functions not meant
for an object interface and summarize, where it's called from?"*

`oneDoor.js` §4 already catches escape hatches that **announce
themselves** — an `internal:` bag, an `_underscore` hook. It does not
catch an ordinary-looking export that is really an internal mechanic, and
that gap is real.

**Measured 2026-09-23 with a throwaway script:** 227 exported names in
`run/js`; **70 with no outside caller, 24 called only from tests.** The
rate of artifact is high and instructive:

- `nodeCard.cardFrom` — **true positive.** Eleven test callers, no
  production caller. It was split out of `describe()` *the same day* so
  suites could build a card from an identity without a home directory.
  That is the `internal:` bag pattern wearing an ordinary name.
- `hub.relayRequest` — **false positive.** Passed by reference
  (`request: require('./hub').relayRequest`), which a `.name(` pattern
  cannot see.
- `partnerAvailability.QUIET_MS` — **false positive.** A constant, read
  rather than called; most of the 70 are this.

So the cross-reference is a script, and the judgement — artifact or
finding — is the part worth a model, and the part it is weakest at.
**Unless the quote gate above is in place**, in which case each candidate
arrives with evidence a script has already confirmed exists.

## Is there an overnight-shaped job? — Yes, and with the gate it may include review

**What a night is worth is breadth, not depth**, and what makes breadth
safe is a check that costs nothing. Three jobs qualify today, in order of
how cheap their verifier is:

1. **Dead-code sweep** — the harness is the verifier. Four minutes,
   3007 assertions, no human in the loop.
2. **The door contract draft** — bulk, an alpha deliverable, wanted by
   developers who are not us, and every claim checkable against
   `verbTable.js` and `spiritErrors.js` in the morning.
3. **Review, but only behind the quote gate** — and it is on the list at
   all only because fabrication turned out to be mechanically
   detectable.

## One night proves a pairing, not a model — so the runs are filed

> Andy: *"so an over a week evaluation could teach us valid uses, we also
> want to file the perormance history of this modes, so we can track and
> categorize thir optimal use...."*

Everything above is **one row of evidence**, and it is about a pairing —
*this model, given review* — not about the model. A week of rows, each
changing one thing, is what turns that into something to steer by.

`MODEL-HISTORY.md` beside this file is the ledger: one appended row per
run, columns chosen so nobody has to reason to fill them in. The two that
decide everything are **`fabricated`** and **`triage`**, because GPU hours
are nearly free and attention is not.

**A week varies one axis at a time:** the JOB against a fixed model
(review, then a dead-code sweep, then the door contract draft); the
PACKAGING — one digest, verbatim quotes, the gate running — measured by
the `triage` column; then the MODEL against a fixed job, the 20b against
the 120b on the same sweep, since a smaller model that fabricates less on
mechanical work is the better tool and the cheaper night.

**The end state is a short table**: for this kind of job, use this model,
and expect this much of it to be wrong.

## The standing decision

**It rests until the core is at alpha.** Andy: *"then we let it rest until
core is at that alpha level."* The GPU is not needed for core work, and
the next run should be aimed at a job from the list above rather than
repeating a review.

**Two things are owed, and neither is lost:** the 242 findings have never
been triaged, and `readAll` on the unbounded permanent log belongs with
the other deferred hardening when the traffic log is next opened.
