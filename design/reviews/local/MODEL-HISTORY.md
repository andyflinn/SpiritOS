# Local model performance history

**Opened 2026-09-23.** Decided by Andy: *"so an over a week evaluation
could teach us valid uses, we also want to file the perormance history of
this modes, so we can track and categorize thir optimal use...."*

> **THE POINT, in Andy's words: *"we want to learn and track which model
> is useful for what."*** Not whether local models are good. **Which one,
> for which job.**

**One row per run, appended, never rewritten.** A single night says almost
nothing — a model that fabricates once may have been unlucky, and one that
found nothing may have been given the wrong job. **A week of rows says
something**, and that is the only reason this file exists.

## What we know so far

The table this is all for. **One cell is filled.** Everything else is
honestly blank rather than guessed, because a guessed cell is worse than
an empty one — it gets believed.

| job type | gpt-oss:120b | gpt-oss:20b | later |
|---|---|---|---|
| **review** (open-ended, per file) | ✗ **no** — fabricates; a false finding is indistinguishable from a true one, and only a person can tell | — | — |
| **corpus extraction** (one question, quotes verified) | — | **built, never run on a real corpus** — mechanism smoke-tested 2026-09-23; the cell stays empty until a night against real documents fills it | — |
| **dead-code sweep** (harness verifies) | untried — **next** | untried | |
| **breadth sweep** (one pattern, grep-checkable) | untried | untried | |
| **draft** (door contract, notes) | untried | untried | |
| **classify** (into buckets we supply) | untried | untried | |
| **reformat / translate** | untried | untried | |

**A cell is filled only from a row below**, never from an impression.

## How to fill a row honestly

The columns are chosen so that **nobody has to reason to fill them in**.
A ledger that needs judgement per row is a ledger that stops being filled.

| column | how it is got |
|---|---|
| **run** | the folder or zip the output is in |
| **model** | as Ollama names it |
| **job** | the job TYPE, from the list in `LOCAL-MODEL-REVIEW.md` — sweep, draft, review, classify, reformat |
| **scope** | what it was pointed at, and how much |
| **wall** | start to finish, unattended |
| **out** | findings, or pages, or rows — whatever the job produces |
| **true / false / unchecked** | of the ones somebody actually checked. **`unchecked` is the honest majority and must be filled in, not left blank** |
| **fabricated** | claims whose quoted evidence does not exist in the file. Countable by script once findings quote verbatim |
| **triage** | minutes of agent or human attention spent separating signal from noise — **the real price of the run** |
| **verdict** | one sentence: was this job worth giving this model |

**The two columns that decide everything are `fabricated` and `triage`.**
GPU hours are nearly free (Andy: *"if 6 hours tittering away only cost me
a little bit of power"*), so a run is cheap unless it costs attention.
Fabrication is what makes it cost attention.

## The runs

### 2026-09-22-night

| | |
|---|---|
| **run** | `2026-09-22-night.zip` |
| **model** | gpt-oss:120b (Ollama, 5060 Ti) |
| **job** | review — unbounded, per file |
| **scope** | 47 files of `spirit/run/js`, sliced for the large ones |
| **wall** | 15 h 39 m (16:16 → 07:55), unattended, completed |
| **out** | 242 findings — 124 `[REGRESSION]`, 118 `[DESIGN]`, 10 `[UNVERIFIED]` — across 44 of 47 files |
| **true** | 3 sampled (`readAll` unbounded read; `rateOk` never prunes below its sweep threshold; the `kernel.js` EventSource tension, which is real but already decided) |
| **false** | 3 sampled (`fitsWrapped` overhead; unlimited `carry`; relay-mode reads, true as stated and hollow as argued) |
| **unchecked** | **236** |
| **fabricated** | 1 confirmed of 6 sampled — `PARTNER_QUILT_MS`, an identifier that appears nowhere in the file, quoted as though copied |
| **triage** | ~40 min of agent attention for 6 findings, and the count was got wrong on the first pass |
| **verdict** | **The delegation works; the job was the wrong one.** It held its format for fifteen hours, invented and correctly used an `[UNVERIFIED]` tag, and read `AGENT.md`. But it fabricates, and review is the job where a fabrication is indistinguishable from a finding. Give it work whose output a script or the harness can check. |

**What this row is missing, and it is the point of the next one:** nobody
has read 236 of the 242 findings. The true/false split above is a sample
of six, chosen because they looked sharpest — which is a biased sample, and
flatters nothing.

## What a week should vary

One row proves nothing about a model; it proves something about a
**pairing** of model and job. So the runs worth spending a week on change
one thing at a time:

- **the job**, holding the model still — review, then a dead-code sweep,
  then the door contract draft. This is the axis that matters most, and
  the cheapest to learn from.
- **the packaging** — one digest instead of 47 files, and findings that
  quote verbatim so the quote gate can run. Measure `triage` before and
  after; that column is the experiment.
- **the model**, holding the job still — the 20b against the 120b on the
  same sweep. A smaller model that fabricates less on a mechanical job is
  the better tool for it, and cheaper per night.

**What we are trying to end up with** is a short table that says: for THIS
kind of job, use THIS model, and expect THIS much of it to be wrong.
Nothing more ambitious, and nothing less useful.

## Standing decision

**It rests until the core is at alpha** (Andy). The week's evaluation
starts after that, and the first run after the rest should be the
dead-code sweep — because the harness verifies it for free, which makes
the `triage` column nearly zero and gives the ledger a clean second row.


## Corpus extraction — the job, and why it is shaped this way

**Opened 2026-09-23**, on Andy: *"before we all sign off we setup local AI
to do things like market research. like (are the bitcoiners and crypto-bros
looking for an szstem on a usb-stick that has their wallet and UI all in
one?"*

**The reframe the runner is built on.** Asked that question directly, a
local model answers fluently, from training data of unknown age, with no
sources, and nothing can tell the answer from an invention. That is the
failure this project spent the same day removing from its capacity
figures — and it is worse here, because a wrong capacity number is caught
by a re-measurement and a wrong market claim is caught by nobody.

So the job is **extraction from a corpus we fetched**, not research: one
question, documents already on disc, and every finding carrying the words
it came from.

**The citation is enforced by the runner, not requested in the prompt.** A
model told to quote its source quotes it most of the time, and *most of
the time* is the problem — one fabricated quote among ninety real ones is
indistinguishable, and it is the one that reaches a positioning document.
So every quote is checked character-for-character against the document it
claims to come from, and dropped if it is not there. The model proposes;
the runner verifies. Whitespace is forgiven and nothing else is.

**It does not fetch.** Fetching is deterministic and auditable and belongs
in a script somebody can read and re-run, not inside an unattended model
job. A document with no `SOURCE:` line is skipped and counted.

**What a run reports** is the number kept, the number discarded for
quoting text that is not there, and the number skipped for having no
source. **The discard count is the measurement that matters** — it is this
job's fabrication rate, per model, per night, and it is the number that
will eventually fill the cell above.

`spirit/run/process/js/localResearch/localResearch.js`
