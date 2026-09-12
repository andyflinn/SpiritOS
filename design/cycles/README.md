# Cycles — what was agreed, and how it is known to be done

**Why this exists, in one incident.**

On 2026-09-12 Grok reviewed `design/relay/DEVICE.md` and returned six
findings as a numbered list. In the same conversation Andy and Claude
worked out, in detail, that the relay must confine a device's posts to its
owner's node — the mechanics, the addressing, the pairing. Both were
agreed. Only one of them was a numbered list.

The six got built and reported as *"53 suites, 1426 green"*. Andy then
asked whether the confinement was implemented. It was not. It had been
written into `DEVICE.md` as a note — *"these two must land in the same
cycle"* — which is reading material, not a worklist.

Andy:

> we need to have a working method where that stuff doesn't get missed,
> no matter what grok wants. i always expect a concept we both agree on
> in relation to an active/current issue, like review related fixes, that
> those parts we both agreed on become requirements, subject to
> verification with tests.

So: **an agreement is a requirement the moment it is made, and a
requirement is not done until something verifies it.**

---

## The rule

**1. Agreement goes on the list before anything is built.**
The moment Andy and Claude settle a thing related to open work, it is
added to the cycle file — quoted in Andy's words where he said it, so a
later reading cannot soften it into a paraphrase.

**2. Every item carries its verification.**
A named test, in a named file. Not "covered by the harness" — a check
somebody can run and watch fail. An item with no verification is not
done, however finished the code looks.

**3. Deferral is allowed; silence is not.**
An item may be `DEFERRED` with a reason and, where it exists, a
prerequisite. What may not happen is an item quietly leaving the list.

**4. Andy's agreement outranks a reviewer's advice.**
Grok said "do not build the router device→owner check". That was advice,
and it was treated as authority. It is not: a review is input, and what
Andy and Claude agree is the decision. When the two conflict, the
agreement wins and the disagreement is recorded rather than resolved by
deferring to the outside voice.

**5. "Green" is not a completion report.**
`53 suites, N green` says the code that was written works. It says
nothing about whether what was agreed was written. **Completion is
reported against this file**, and the harness figure is a separate
sentence.

---

## What keeps it honest

`spirit/test/cycleRequirements.js` reads every open cycle file and goes
**red** if any item has neither a verification that exists nor a recorded
deferral.

That is the part that matters. A document can be forgotten; a red suite
cannot. It does not check that a test is *good* — nothing mechanical can —
but it makes an unimplemented agreement impossible to lose, which is the
failure this exists for.

## Shape of a cycle file

```markdown
# <date> — <name>

**Status: OPEN** (or CLOSED, with the commit that closed it)

## Requirements

### R1 — <one line>
> the agreement, quoted

**Verify:** `spirit/test/<file>.js` — "<the check's own words>"
**Status:** DONE | DEFERRED: <reason> | OPEN
```

`Verify:` names a file that must exist. `DEFERRED:` must carry a reason on
the same line. Anything else is red.
