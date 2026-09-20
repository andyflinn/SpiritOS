# 0015 — The owner watches a lever; the programme moves it

**Decided 2026-09-20 by Andy. Measured against `af74fcd`.**

> "this design does not include or consider the owners node moving levers
> remotely and or interactively. The governor will be a result of
> programming."

> "the only real-time tool the owner gets while node and relay are
> running: injecting foreign partners."

— Andy, 2026-09-19, cycle 4 planning. Both already recorded in
`design/principles/NODE-AND-RELAY.md` §*Scope: the owner's only real-time
tool is the partner list*.

> "The monitor should allow the owner to observe and see changes
> happening, not cause changes. see and record changes, in fact. and from
> the recording-analysis, teach the relay better effectiveness through
> program changes."

— Andy, 2026-09-20, on finding cycle 4.1 had built the opposite.

## The decision

**A lever is moved by the programme. The owner watches it move, and the
record of those moves is what changes the programme.** The loop is
observe → record → analyse → reprogram, and the owner's hand enters it at
*reprogram*, between cycles, not at runtime.

This is not new. It is 0009 pointed at the Governor: the record is the
substrate, and an owner who can reach in and move a value is an owner
writing into his own training set.

## What was built instead, and what happens to it

4.1 shipped an owner verb `{ lever: { name, set } }`, a shed remedy on
the relay, and an input with an Apply button in the Relay Monitor. That
contradicts the scope above, which was decided the day before and written
into the principles document by the same agent that then ignored it.

**It is kept, dormant, rather than deleted** (Andy, 2026-09-20: *"i don't
want you to reverse it just yet. I see things worth keeping"*). Cycle
rule 6 calls this a marked seam rather than a temporary shape: the path
is proven and tested, and the day a lever *should* be owner-controlled,
the capability does not have to be rebuilt and re-argued from nothing.

## Two properties a lever declares

**`settable`** — replaces `live`, because `live` reads as *is this lever
running* and the question is *who may move it*.

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

## How this was missed, recorded because the guard existed

`NODE-AND-RELAY.md` carried the scope decision in four places, including
a section heading containing the word **Scope**, written the previous day
by the agent that then built the opposite. The failure was not a missing
rule or a lost decision: the plan named a deliverable, and the plan was
checked against the *code* rather than against the *principles*.

`AGENT.md` would also have caught it — *"a tweak that needs bones surgery
is not a tweak… stop and call a team review"* — and a wire verb added to
serve a button is exactly that case. A plan does not waive it: **a plan
is an artifact the governing files govern, not a governing file.**

## The cost of waiting

Low, and mostly already paid. The dormant path costs one test asserting
it stays dormant. The meter is a day's work in one app. The recording
store is the expensive part and is deferred here deliberately, because
what to keep is a design question and *"log everything"* is the answer
that sounds right and produces a file nobody reads (0009).
