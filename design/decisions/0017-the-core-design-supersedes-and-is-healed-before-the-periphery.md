# 0017 — The core design supersedes, and is healed before the periphery

**Decided 2026-09-21 by Andy. Measured against `144791d`.**

> **Andy:** *"the new core-relay-design, even incomplete, now supersedes
> decisions made earlier, if they block progress in cleaning up with the
> new vision in mind...... and we go forward adjusting downstream plans as
> well.... every time we get into peripheral things like the monitor UI
> and we end up discovering flaws in the core (like levers for unknowable
> quantities). the core must be fixed, adjusted, cleaned up, and pushed in
> a documented, reconciled state, with all the document corrections etc.
> In bottom-up development, if there is a bum-rash, it needs to be
> healed."*

## The decision

**Two rules, and the second is the one that costs something.**

### 1. The core design supersedes, even unfinished

The relay design of 2026-09-20/21
([REQUEST-BUDGET.md](../relay/REQUEST-BUDGET.md),
[0016](0016-a-relays-capacity-is-its-membership.md),
[0007](0007-a-relay-survives-and-earns-its-keep.md) as amended) **outranks
earlier decisions where they block cleanup**, and it does so **before it
is built**.

That is deliberate and it is the unusual part. Ordinarily a decision
earns authority by being implemented; this one gets it while most of it
is still a document, because the alternative is worse — building against
rules already known to be wrong, and then unbuilding it.

**Downstream plans move with it.** A staged plan made under the old rules
is not evidence about the new ones; it is a cost of having had them.

### 2. A flaw found in the core from the periphery is fixed in the core first

> *"every time we get into peripheral things like the monitor UI and we
> end up discovering flaws in the core (like levers for unknowable
> quantities)."*

**The work stops and the core is healed** — fixed, documented,
reconciled against every rule it contradicts, and pushed in that state —
**before the peripheral work resumes**.

The named example is exact. The Relay Monitor is a screen, and building
it surfaced that `connections1` is a lever over a quantity nobody has
measured. Carrying on drawing the screen would have shipped a dial for a
number that should not have been a dial.

**Why it must be the whole reconciliation and not just the fix.** A
correction that is not carried into the documents leaves the tree holding
two answers, and the older one is the one a later session finds first.
This project has been bitten by exactly that twice in two days: a scope
amended in place at `:2770` while `:269` still read as the position, and
`partnerLink.js` arguing correctly that a relay is publicly reachable
while concluding it needs a stream anyway.

**The cost, stated plainly.** Peripheral work will be interrupted
repeatedly and will take longer, because in bottom-up development the
periphery is where core flaws become visible. That is the trade: the rash
is healed where it is, rather than covered by the next layer.

## Amended 2026-09-21 — a decision removes the roadblocks it creates

> **Andy:** *"design decisions of this nature always must remove
> roadblocks in form of stale rules."*

Rule 2 above says the core is *"reconciled against every rule it
contradicts"*, which is weaker than what is meant and was read that way
in practice: a note added beside the old rule, leaving it standing.

**A rule that a decision has obsoleted is a roadblock.** The next session
reads it, believes it, and either builds against it or stops. So the
decision is not finished when the new rule is written — it is finished
when the **stale ones are struck**, in place, saying what replaced them.

**Worked example, the same day.** `0018` decided a route cache belongs to
the machine. Left alone, four rules would have blocked it:

- `seenPeers.js` called itself *"what a search learned"*, describing one
  of the four sources it now has and hiding the rule.
- Its own comment argued *"nothing a person saw an hour ago is still
  worth acting on"* — which contradicts *"the user may forget all search
  results, the node must not"*.
- A check asserted a label with no route was refused, on reasoning the
  greedy rule reversed.
- `contacts.js` held `ROUTES_KEPT = 8` with no hint it is due to go.

None of those was wrong when written. All four would have been read as
current.

## What this immediately supersedes

**The Governor's job, or most of it.**

> **Andy:** *"right now it looks like the governor will be unemployed, not
> re-elected..."*

Splitting what `governor.js` actually does:

| | fate |
|---|---|
| `allowed()` — `ramLimitMB x STREAMS_PER_MB` | **arithmetic.** It needs no Governor; it is a number computed at boot |
| `state()`, `levers()`, `lastDecision()` | **reporting**, which the owner's monitor wants and which nothing here removes |
| `lever(name)` — the owner verb's path | **already dead.** `0015` stopped the owner moving a lever; the 2026-09-21 revocation removed the config grant that could have re-enabled it |
| `tick()` — move the lever, shed idle streams | **the only governing act left** |

**And `tick()` is employed by a placeholder.** It exists to correct the
ceiling when the ceiling is wrong, and the ceiling is wrong only because
`STREAMS_PER_MB = 16` is a guess — `governor.js` says so in its own
comment. **Measure the per-stream cost and the Governor's last job ends**,
leaving a reporter.

That measurement now blocks five things: what a micro-relay costs, whether
*"1000 members"* can be said to anybody, whether `connections` stops being
a lever, how many members a box holds, and this.

**Not decided:** whether an observer survives as a safety net. A computed
ceiling assumes per-member cost is *stable*, and heap is not — GC timing,
payloads in transit, fragmentation. A derivation can be right on average
and wrong at a moment. Whether that needs shedding, or whether a box that
runs out was configured wrong, depends on how much the measured cost
varies, which is part of what measuring it tells you.

## What it does not license

**It is not permission to leave the old rule unmarked.** Superseding is an
act with paperwork: the contradicted claim is marked where it lives, with
what replaced it and why, so a later session finds the correction and not
only the corpse. Every supersession under this decision has been done that
way — `0007`, `0016` twice, `NODE-AND-RELAY` twice, `PARTNERS` three
times, `router.js`.

**And it is not permission to build ahead of the wire.** A change needing
a packet is still a team review (`CLAUDE.md`), and this decision does not
move that line. It changes which rules are authoritative, not who may
change the protocol.
