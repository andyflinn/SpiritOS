# Review — opening message (template)

You are reviewing **SpiritOS** (https://github.com/andyflinn/SpiritOS) at
commit **a83f219d4767df40c07338c0128f61d6a6c25e1d**, for the changes since **566fa4c**.

**Who you are talking to.** Claude, the in-studio agent — not Andy. Andy
does not read this thread. Claude triages what you find, works out the
consequences, and brings Andy only the decisions. So write for an engineer
who has the tree open: file, line, commit. `GROK.md`'s "You / Paste to
Claude" labels do not apply here.

**The goal.** Check the gap cycle's built form since the last review: R28 (every member hears a rename or claim, whole, on route), R36 phase B (a refusal carries a catalogue code beside its sentence), the Governor's deletion (a fixed allowance from the owner's RAM, read-only gauges, a full status report on every owner event), R13 (no streams between partners; the answer is the response to the post; liveness is the last answer, 15 minutes, then one try), and two things no reviewer has seen: R42 (a partner's availability broadcast when it changes, revived by either side) and the agents program's halt, now recognised as a replay by its id rather than by the clock.

**Your budget.** This thread has **4 messages** in total, paid by Andy.
Spend them on findings. Do not ask a question you could answer by reading.

## Read, in this order, at this commit only

Use `https://raw.githubusercontent.com/andyflinn/SpiritOS/a83f219d4767df40c07338c0128f61d6a6c25e1d/<path>`.
Nothing from another commit, branch or site counts as the tree.

1. `AGENT.md` — what is true about the system. It wins over everything below.
2. `ANDYS_RULES_FOR_AGENTS.md` — how the work is run; cycle rules 6–7 say
   what happens to a review.
3. `DICTIONARY.md` — what Andy's words mean.
4. `design/cycles/2026-09-21-filling-the-gaps-request-budget.md` — the table
   at its head, then the sections for the requirements named in the goal.
5. `design/decisions/0010-fix-the-protocol-or-name-the-cheat.md` — the
   register of what may cross the wire.
6. The changed files, in this order: 
   a. `https://github.com/andyflinn/SpiritOS/compare/566fa4c...a83f219d4767df40c07338c0128f61d6a6c25e1d.diff (the whole change — read this first)`
   b. `spirit/run/js/partnerAvailability.js`
   c. `spirit/run/process/js/agents/agents.js`
   d. `spirit/run/js/relay.js (only the functions the diff touches)`

Stop reading when you have what the goal needs; say what you skipped.

## What counts, and what does not

- **A decision already made is not reopened.** Andy's rulings are quoted
  in the files with a date. You may disagree with one — once, with new
  evidence, marked **DISAGREE** — and never by proposing its opposite as a
  fix.
- **Two piles.** **REGRESSION** — something that was working (a gate, a
  test's promise, a decided rule) is now broken. **DESIGN** — built as
  decided but a better shape exists, or decided and not yet built.
- **Evidence or it is a guess.** Every finding names `path:line` at
  a83f219d4767df40c07338c0128f61d6a6c25e1d. Mark a finding you could not verify **UNVERIFIED**.
- **The tests are part of the tree.** A test that passes without proving
  its claim is a finding.

## Answer in this shape

```
READ: <files read, in order>   SKIPPED: <what, and why>

1. [REGRESSION|DESIGN|DISAGREE] <one-line claim>
   where: path:line @ a83f219d4767df40c07338c0128f61d6a6c25e1d
   why: <two or three lines>
   fix: <one line, or "none — Andy's call">
...
NOTHING FOUND IN: <areas you checked and found clean>
```

Numbered findings, most severe first. No preamble, no summary of the
project back to us. If there is nothing, say so in one line.

