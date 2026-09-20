# 0015 — The owner watches a lever; the programme moves it

**Decided 2026-09-20 by Andy. Measured against `af74fcd`.**

> ## Corrected 2026-09-20, hours after writing, and the correction is the point
>
> **This decision first recorded that cycle 4.1 built against a decided
> scope. That is false, and the false version is kept above the true one
> because the mistake is instructive.**
>
> `NODE-AND-RELAY.md:269` carries Andy's morning statement — *"this
> design does not include or consider the owners node moving levers
> remotely and or interactively"* — and `:2770` carries its **amendment,
> marked in place the same day**: *"the owner's real-time tools are
> signed grants and levers that declare themselves live-changeable —
> through the lever configuration API, persisted to `levers.json`.
> **Corrected the same day: this first said the owner never moves a
> lever.**"*
>
> And `:315-319` specifies the verb 4.1 built: *"no new route. Refused
> for a lever not declared live… **Its first job is a proof:** switch max
> connections from `"dynamic"` to a fixed number while the relay runs,
> and watch the Governor respect it. **Live settings persist to
> `relay-state/levers.json`**, never to `config.json`."*
>
> **So 4.1 implemented the specification.** It did not overshoot it. The
> `live` property it shipped is the specification's own word.
>
> The agent read `§Scope` at line 269, found the superseded statement,
> and concluded from it — never reaching the amendment two thousand lines
> below, written to the very standard this method requires. Having failed
> once by not reading the document, it failed again by reading part of
> it. **A long document with corrections marked in place must be grepped
> across its whole subject, never read at its first hit.**
>
> What remains true, and is the decision below: on 2026-09-20 Andy
> changed his mind. That supersedes the 2026-09-19 amendment, which
> superseded the 2026-09-19 morning statement. Three positions, one
> subject, each marked — which is the method working, not failing.

> "this design does not include or consider the owners node moving levers
> remotely and or interactively. The governor will be a result of
> programming."

> "the only real-time tool the owner gets while node and relay are
> running: injecting foreign partners."

— Andy, 2026-09-19 morning, cycle 4 planning; recorded at
`NODE-AND-RELAY.md:269` §*Scope: the owner's only real-time tool is the
partner list*. **Superseded the same day at `:2770`**, where live-declared
levers became movable by an owner verb. Quoted here because this decision
returns to their substance by a different route, not because they stood.

> "The monitor should allow the owner to observe and see changes
> happening, not cause changes. see and record changes, in fact. and from
> the recording-analysis, teach the relay better effectiveness through
> program changes."

— Andy, 2026-09-20, on looking at what 4.1 had built to spec and deciding
he wanted something else.

## The decision

**A lever is moved by the programme. The owner watches it move, and the
record of those moves is what changes the programme.** The loop is
observe → record → analyse → reprogram, and the owner's hand enters it at
*reprogram*, between cycles, not at runtime.

This is not new. It is 0009 pointed at the Governor: the record is the
substrate, and an owner who can reach in and move a value is an owner
writing into his own training set.

## What was built to spec, and what happens to it

4.1 shipped an owner verb `{ lever: { name, set } }`, a shed remedy on
the relay, and an input with an Apply button in the Relay Monitor —
**exactly what `NODE-AND-RELAY.md:315-319` specified**, down to the proof
it names: switch max connections from `"dynamic"` to a fixed number while
the relay runs and watch the Governor respect it.

This decision does not correct a mistake in 4.1. It supersedes the
specification 4.1 correctly implemented.

**It is kept, dormant, rather than deleted** (Andy, 2026-09-20: *"i don't
want you to reverse it just yet. I see things worth keeping"*). Cycle
rule 6 calls this a marked seam rather than a temporary shape: the path
is proven and tested, and the day a lever *should* be owner-controlled,
the capability does not have to be rebuilt and re-argued from nothing.

## Two properties a lever declares

**`settable`** — renames `live`, which is the specification's word
(`NODE-AND-RELAY.md:315`, *"Refused for a lever not declared live"*).
Renamed because `live` reads as *is this lever running* and the question
is *who may move it*. The mechanism is unchanged; only the name is.

**Every lever in the tree ships `settable: false`.** The owner can move
nothing, which satisfies the scope exactly — by closing the path, not by
removing it. A test asserts **zero** settable levers tree-wide, the same
shape as `oneDoor.js`'s census: turning one on goes red until Andy raises
the number, which makes it his grant, out loud and dated.

> `AGENT.md`: *"There is no category meaning unlimited, because the first
> version had one… and that is precisely what got used."*

A dormant capability is a temptation, so it gets the guard that this
project already trusts for temptations.

**`worseAt`** — `'ceiling'` or `'floor'`, and it exists because of the
meter below.

## The monitor is a meter, not a console

Andy, 2026-09-20:

> "i'd prefer horizontal potentiometers, with tooltips indicating their
> range, maybe ticks if the values have few enough options, in table
> form: name (connections) second column a 100% width horizontal
> level-meter, who's color kind is a gradient from green to red on the
> right"

A meter cannot be clicked, so **the display is the policy** rather than a
control that has been disabled.

Ticks come from the report, not from the app: `connections1` has 2048
values and no useful tick, but the Governor moves in twelfths and already
reports `position: "4/12"`.

**`worseAt` exists because colour is a claim the app cannot make.**
Green→red says *right is worse*. On `connections1` a high value means the
Governor has opened up and the relay is comfortable, so red at the right
would be backwards. On `requestTimeout1` a high value means requests held
longer in RAM, so red at the right is correct. Same gradient, opposite
meanings — and an app that names no lever cannot know which. So the lever
says, next to the floor and ceiling it already declares with reasons.

## What this makes true of what is already built

- `lever.js` keeps `set(v, why, by)`, `heldByOwner` and `held`. They are
  unreachable while nothing is settable, and `test/leverVerb.js` is the
  only thing keeping them honest. That is accepted: dead code with a
  suite is a seam; dead code without one is rot.
- `relay.js`'s `lever` verb stays, refusing every lever because every
  lever refuses. The `lever-set` owner event and its row in 0010 stay for
  the same reason.
- The Relay Monitor loses its input and Apply and gains the table.

## What is NOT decided

- **Which lever is ever made settable, and on whose argument.** The
  answer today is none.
- **What "record" means concretely.** A monitor draws the current
  report; the analysis Andy describes needs a *series* — every move, its
  reason, its capture time, kept. Nothing keeps one. Where that store
  lives, what it costs and what bounds it is a design sitting, and it is
  the substance of this decision's second half.
- **The configure-API** Andy sketched (2026-09-19) for automated
  run-learn-capture-reprogram cycles. That is a programme moving a lever,
  not an owner, so it is not forbidden by this — but it is not designed.

## Persistence, which was decided and is unchanged by this

`relay-state/levers.json`, specified at `NODE-AND-RELAY.md:318` — *"Live
settings persist to `relay-state/levers.json`, **never** to
`config.json` — the file holding the protections is only ever written by
a person with a shell"* — and required by `0013` (*"persist levers, not
statistics; levers are constant-sized, statistics grow"*) and
`CAPACITY.md:663` (*"What survives a restart is the LEVERS, not the
statistics"*).

Nothing persists today: `governor.js` starts every lever at the ceiling,
so a relay throws away whatever it learned on every restart. The plan
stages `levers.json` for **4.2**.

Andy, 2026-09-20: *"lever positions, by design, are persisted on the
relay… so that it can restart in a tuned state… that would include the
held/locked state as well."* So a lock survives a restart and is released
only by its owner, which is what "the owner would have to release that
locked state" requires. It needs no new persist shape: `levers.json` is
already specified, and it is not `relay.db`.

## Three states, not two

`settable` answers *may the owner move it*. It says nothing about the
Governor, and the middle state has Andy's own name from the cycle 4
sitting — *"programmed, final constant, in the learning cycle"*:

| | the programme moves it | the owner may set it | how it ends |
|---|---|---|---|
| **moving** (`connections1`) | every tick | no | — |
| **constant** | no, the learning cycle concluded | no | a reprogram |
| **locked** | no, the owner holds it | it was set | the owner sends `dynamic` |

A constant and a lock both sit still, and they are not the same thing:
different authority, different duration. The meter should draw them
differently — a constant is settled, a lock is *someone is holding this
now*.

**`constant` is not added as a property yet.** No lever in the tree is
one, and a field with no instance invites filling the structure instead
of thinking. The first concluded learning cycle is what will say what it
needs to carry.

## What was actually missed

Not the scope — 4.1 met it. What was missed is that the principles
document was never read before building, and then was read badly: its
first hit on the subject was taken as its position, while the amendment
marked below it was not reached.

The lesson that survives, and the only one: **before building anything a
plan names, grep the principles for the subject and read every hit.** A
document that corrects itself in place — which this method requires —
cannot be understood from one of its statements. The correction is
somewhere else in the file by construction.

## The cost of waiting

Low, and mostly already paid. The dormant path costs one test asserting
it stays dormant. The meter is a day's work in one app. The recording
store is the expensive part and is deferred here deliberately, because
what to keep is a design question and *"log everything"* is the answer
that sounds right and produces a file nobody reads (0009).
