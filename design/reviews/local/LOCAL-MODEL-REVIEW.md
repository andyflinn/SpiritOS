# What a local model is good for, measured on a night of it

**Written 2026-09-23, from the run in `2026-09-22-night.zip`.** Decided by
Andy: *"we need to log our assessment of what the local ai is usefull for,
and find jobs it can do, that help. smaller scope, much lower reasoning."*
And on what happens next: *"then we let it rest until core is at that
alpha level."*

## What was run

wsl-claude drove **gpt-oss:120b through Ollama**, on the 5060 Ti, over
**47 files** of `spirit/run/js`. It ran **16:16 to 07:55 — fifteen and a
half hours** unattended, and it finished. Larger files were cut into
slices: `relay.js` took 85 minutes across six, `hub.js` 47 across four.

The output is in the zip: one markdown file per source file, a progress
log, and the run's stdout and stderr. **Kept whole rather than summarised**
— the point of a measurement is that somebody else can check it.

## What it produced

**14 findings across 3 files.** The other 44 files produced none.

| | |
|---|---|
| `[REGRESSION]` | 10 |
| `[DESIGN]` | 4 |

## The assessment, which is the part worth keeping

**It proves the delegation works.** A local model ran unattended overnight
on hardware already in the room, read 47 files, produced structured output
in the requested shape, and cost nothing but electricity. Nothing crashed,
nothing had to be babysat, and the results were waiting in the morning.
That question is answered: **work CAN be delegated to a local AI.**

**And it changes what we would delegate to it.** Triaged against the tree:

- **`fitsWrapped` ignores the wire overhead** — *false.* It builds the
  actual wrapper and measures it, and the comment above it says so in as
  many words: *"Exact rather than estimated: build the wrapper the relay
  would build and measure it."* The model asserted the opposite of what
  the code does, in its highest-confidence finding.
- **Unlimited `carry` objects enable a DoS** — *false.* The route table is
  capped (`max`, 256 by default) and entries expire on a ttl, so `carry`
  is bounded by the table that holds it.
- **`var` should be `const`; freeze `window.spiritLimits`** — *style,
  filed as `[REGRESSION]`.* Two of ten.
- **Relay-mode reads are not gated** — *true as stated, hollow as argued.*
  `note()` refuses to write on a relay, so there is no log on a relay to
  read. Gating the reads too is cheap defence in depth, not the violation
  it was called.
- **`readAll` loads the whole log into memory** — **TRUE, and worth
  keeping.** The log is permanent by Andy's decision (*"the log should be
  permanent. period."*) and every read is `readFileSync` plus a split. On
  a long-lived node that is unbounded RAM on every read. This one is a
  real finding nobody had made.

**So: one real finding, several false ones stated with total confidence,
and style filed as regression.** The signal is there and it is buried in
noise that costs more to clear than the finding is worth — because
checking a confident false claim about `fitsWrapped` takes a human or a
better model reading the same code.

**WHERE IT WENT WRONG IS THE USEFUL PART.** Every false finding is the
same failure: it reasoned about what the code *probably* does from its
shape, instead of reading what it does. It saw a size comparison and
assumed the naive one. It saw a held object and assumed no bound. This is
not a model that is bad at code; it is a model that is bad at **holding a
whole argument while checking a claim against it** — which is exactly what
a review is.

## So what to give it instead

Jobs with **small scope and low reasoning**, where being wrong is visible
rather than plausible:

- **Mechanical sweeps with a checkable answer** — every file that names a
  deleted function; every `TODO`; every route with no caller. A wrong
  answer here is a name that does not exist, which the next grep settles.
- **Drafting, for a human or a better model to cut** — first-pass release
  notes from a commit range, a changelog, a summary of what a file does.
  Wrong drafts are cheap; wrong reviews are expensive.
- **Translation and reformatting** — a table into prose, a log into a
  digest, one shape of JSON into another.
- **Bulk classification against a fixed list** — sorting findings, commits
  or errors into named buckets, where the buckets are given and it only
  has to choose.
- **Test data and fixtures** — plausible names, labels, descriptions in
  bulk, where nothing depends on the content being right.

And **not**: security review, protocol reasoning, anything where a
confident wrong answer looks exactly like a right one.

## The standing decision

**It rests until the core is at alpha.** Andy: *"then we let it rest until
core is at that alpha level."* The GPU is not needed for the core work,
and the next run should be aimed at a job from the list above rather than
repeating a review that cost fifteen hours and returned one finding.

**The one real finding is not lost:** `readAll` loading the whole
permanent log belongs on the list with the other deferred hardening, and
should be raised when the traffic log is next opened.
