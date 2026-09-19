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

A cycle file also carries an **"Anticipated failures"** section: what we
expect can go wrong, and what the user sees when it does. Plans carry no
guarantees (Andy, 2026-09-19).

## How a cycle is shaped — the pattern cycle

**DRAFT for Andy to correct** (agreed 2026-09-19: "at the end of this
planning session, we codify a pattern cycle we both find effective"). Named
by Andy while planning cycle 4:

1. **Dream the shape** of the next cycle — the whole of what it could be.
2. **Pare it down** to the most minimal first step that is achievable.
3. **Clamp its scope** to that minimum, listing what is left out on purpose.
4. **Amend planning errors and reconcile** with the larger vision and the
   existing rules — every correction marked in place, never silently
   edited. *Step 4 is the one that gets skipped, and without it a minimal
   step drifts from the dream it came from.*

The two halves of it:

| Andy | Claude |
|---|---|
| dreams the shape, holds the vision | pares and clamps; proposes the smallest achievable step |
| triggers step 4 when a proposal drifts from the vision | runs step 4 **before presenting anything**: does it break a decided rule; who holds authority; does it supersede something, and is that marked; does it promise what it cannot guarantee |
| decides; may cancel a feature once its cost is visible | checks every premise against the tree, with a file and a line |
| | asks in plain text, never in a prompt; never asks for approval while an issue that changes what gets built is open |

Andy should only need to trigger step 4 for what only he can see — the
vision. *(End of the draft: Claude's first wording of this section, not yet
corrected by Andy.)*
