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

## Is there an overnight-shaped job? — Yes, and it is not review

**What a night is worth is breadth, not depth.** The shape to aim for:
one question, asked of every file, whose answer is mechanically
verifiable. Review fails that test on the last clause. A sweep passes it.

The best candidate on the current list is the **door contract draft**: it
is bulk, it is an alpha deliverable, it is wanted by developers who are
not us, and every claim in it can be checked against `verbTable.js` in the
morning.

## The standing decision

**It rests until the core is at alpha.** Andy: *"then we let it rest until
core is at that alpha level."* The GPU is not needed for core work, and
the next run should be aimed at a job from the list above rather than
repeating a review.

**Two things are owed, and neither is lost:** the 242 findings have never
been triaged, and `readAll` on the unbounded permanent log belongs with
the other deferred hardening when the traffic log is next opened.
