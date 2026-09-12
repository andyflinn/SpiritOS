# 0007 — A relay has one job: survive, which includes earning its keep

**Decided 2026-09-12 by Andy. Against `4a0d51e`. Nothing implemented.**

> the relay must [have] one job only: "survive", this includes "earn your
> keep".

## The decision

A relay is not a service the system provides. It is a box that has to
justify its own continued existence, on its own, against its own running
cost.

Two obligations, and the second is the one that is new:

- **Survive** — stay up, under load and under attack, and prefer refusing
  to degrading.
- **Earn its keep** — have a reason to exist that somebody would pay for.

Everything else a relay might do is subordinate to those two. A feature
that does not help it survive or help it pay for itself is not a feature
a relay should have, however useful it would be somewhere else.

## Amended 2026-09-12 — "survive" is every server's job

Andy, after the first draft of this decision:

> all servers node and relay MUST be designed to survive and do their
> job…. it's the responsibility of the node-code to safeguard itself,
> same goes for the satellite

So the title is narrower than the rule. **Survive** belongs to every
server in the system; **earn its keep** is the half that is a relay's
alone, because a node is paid for by the person whose node it is.

### The principle, and it settles three open questions at once

> **A server does not delegate its own survival.**

Each of these was open before that sentence and is closed by it:

- **The enrolment rate limit.** Grok's finding was that `DEVICE_PER_MIN`
  binds callers of the relay's `deviceOffer` and does nothing about a
  crooked relay, while `deviceTick.answerOffer` has no counter at all. The
  question was *"move it, or add one?"* — and the answer is **both keep
  one, because they defend different things.** The relay limits to protect
  itself from its callers; the node limits to protect itself from its
  relays. Neither is redundant.
- **The floor on unknown senders** ([DEVICE.md](../relay/DEVICE.md) §1c).
  A node that leaves its front door to whichever guest lists its relays'
  owners keep has delegated its own survival to people it did not choose.
- **`listenSet` on the router path.** Same reason. The relay decides who
  may be *present*; only the node can decide who it will *hear*.

### And it names the pattern behind all three

Twice now a gate has lived on a transport being retired and not been
carried to the transport replacing it — `deviceHandshake.js` took the
enrolment rate limit with it, and `listenSet` never left the `inbox` path.
Neither went red, because **nothing fails when a check is merely absent.**

Standing question for any retirement from here: **what did the old path
check that the new one does not?**

## What this settles that was open

[The Peerlink review](../reviews/2026-09-12-peerlink-world-view.md) §2
left a product question it could not answer from the code:

> **satellite or ground station?** A satellite carries anybody in line of
> sight. A ground station decides who may use it. It changes whether
> `claim` and `allow.json` survive at all.

**"Earn your keep" answers it: ground station.**

A box that must justify its own cost has to know what it is carrying and
for whom. An anonymous relay routing for anyone in line of sight has no
ledger, no defence against being used as free infrastructure, and nothing
to sell. So `claim`, `allow.json` and the peer roll stay — but the review's
finding about *why* still holds and is now sharper:

> presence is RAM-only, so routing touches no disk — the persisted table
> is a membership roll, not routing information.

**The roll is the ledger, not the routing.** That is the right way to
describe `routingTable.json` from here, and it is a better justification
than the one it had (which was "resolveParty needs it"). Decision 0006
said the peer directory was *"softer than it looks"* because a key proves
itself without one. True, and beside the point under this decision: it is
not kept to identify anybody, it is kept to know who this box is working
for.

## What this does NOT mean

**It is not an instruction to count bytes today.** Andy, on being shown
what a `--relay` currently costs at rest:

> this is very true, but when it actually deploys in the real world it
> will be deployed without any code that the relay never uses.... these
> are all prototypes, and the way they are deployed after we achieve
> alpha and beta and release will look drastically different from today.

Accepted, and it retires the cleanup this nearly became. Measured on a
bare `--relay` at `4a0d51e`, for the record and as an input to a later
build rather than as a list of bugs:

| measured | |
|---|---|
| idle RSS | **55.4 MB** |
| `startStatsJob` | every **2s**, forever — and `/api/jobs` and `/api/events` both **404 on a relay**, so nothing can ever read it |
| the fs-watcher | walks 94 files on every routing-table write, to notify a shell that does not exist |
| `app/` code on disk | 285 KB a relay can never execute |
| the HTML face | **605 bytes** — already minimal, and smaller than expected |

The structural cause is real — `--relay` is a **flag, not a build**, so
everything is present by default and switched off by exception — and it
is also exactly what a release build makes moot. **This is packaging, and
packaging is a deployment problem, not an architecture problem.** The
list above is useful later as *what a relay never touches*; it is not a
sitting now.

The one thing worth carrying forward as design rather than packaging: a
relay-only entry point would make the claim **testable** — "a relay loads
no app code" is a check, where "a relay does not use app code" is a hope.
Worth having when the build exists. Not before.

## Separate repos, eventually — and the seams are already there

Andy:

> While it is smart to prototype in a common repo, sooner or later, there
> have to be repos: SpiritOS-shared, SpiritOS-satellite or relay,
> SpiritOS-shell, or another form of well organized structuring that
> separates concerns that are unique to component

**A direction, not a cycle.** Recorded because the measurement is cheap
now and will not be later — and because it turns out to be an observation
rather than a proposal.

### The kernel is the common root (Andy)

> kernel should be the common root.

**And it already is, which a first reading of the `require` graph
misses.** `kernel.js` opens with `isNode()` / `isBrowser()` (lines 7–12),
defines the `spirit.core` namespace everything hangs off, and exports to
both environments — `module.exports = spirit` at :624 for Node, the global
for the browser. It is not the shell's kernel that a relay happens to
borrow. It is the floor.

So the layering is four, not a flat list of four peers:

```
kernel                      ← the common root
  + relayAuth, deviceAuth, packet, buildStamp, invites   ← the protocol
      ├── satellite   relay, presence, router, relayConsole
      ├── node        hub, peerPost, presenceNode, answerRelay,
      │               deviceTick, trafficLog, whoBook, ownerBadge,
      │               peerFile, peerStats, sseClient
      └── shell       client/shell.js, index.html, app/*
```

Taken from the `require` graph at `4a0d51e`, not from a diagram. Four
modules — `presence.js`, `invites.js`, `trafficLog.js`, `whoBook.js` —
require **nothing at all** and are already portable as they stand.

**A correction recorded rather than edited away:** an earlier draft of
this section put `kernel` in the shell column and called `relay.js:515`'s
`require('./kernel')` a seam violation. That had the direction backwards.
Depending on the common root is what every component is supposed to do;
it is the only dependency that may point that way.

### The real question is whether the root is lean

What a relay genuinely does not need is sitting **inside** the root rather
than being wrongly reached for: the `ICON` table (`kernel.js:901`),
`MIME_TYPES` (`:1091`), and the browser half of `spirit.core.jobs`
(`:804`). A relay loads all of it to reach `VERSION`.

That is not a layering error, it is a **weight** question, and it is
exactly what a split would answer — the root that a satellite links
against should contain what a satellite can use. `isNode()` already marks
most of the boundary; nothing enforces it.

Worth not fixing piecemeal. A lone `require` tidied away is a fossil in
waiting; the same change made as part of a split is structural.

### What the split would buy, and cost

**Buy.** The relay build stops being a flag and becomes a build — *"a
relay loads no app code"* turns from a test into a fact. The trust root in
[DEVICE.md](../relay/DEVICE.md) §7 becomes auditable by construction
rather than by discipline, because the apps are not in the repository to
ship. And the components' dependencies become visible instead of
conventional.

**Cost, and it is real.** The shared module **is the wire protocol**, so a
change to `relayAuth.js` becomes a three-repo change. Version skew between
node and relay stops being implicit — though it already exists and has
already bitten: spirit-3 ran one build behind for a day and a fixed bug
appeared not to be fixed. **Separate repos make that skew visible rather
than creating it, which is an argument for.** The harness would have to
span repos or be split, and `labWorld` / `labMaster` build a relay and
nodes from one tree via `git ls-files`, which is the piece that would need
real rework.

## Survive

Mostly already the posture, and now it has a name.

[0006](0006-fast-and-true-not-guaranteed.md) is survival reasoning that
was argued on honesty grounds: a relay that delivers or refuses, holds
nothing and promises nothing cannot be filled up, cannot be made to
reorder time, and cannot be turned into anyone's disk. Everything 0006
deletes is also something that could be used to sink the box.

What survival adds that 0006 does not say:

- **Every unbounded thing is a liability.** The rate buckets
  (`CLAIM_PER_MIN`, `SEND_PER_MIN`, the restored `DEVICE_PER_MIN`) exist
  for this, and the one that went missing today went missing precisely
  because nothing named the principle it served.
- **Refuse rather than degrade**, which is 0006's sentence pointed at
  load instead of at truth.
- **Unknown scale.** Named in
  [TRANSPORT.md](../relay/TRANSPORT.md) as *what has not been shown*: one
  exchange at a time, one laptop, one route. Nobody has measured what a
  hundred held streams cost. Under a decision whose first word is
  *survive*, that stops being an academic gap.

## Earn its keep

This is the new half, and the honest position is that the system has one
line of product in it and it is three lines of HTML.

`relay.html` — the whole public face of a relay, 605 bytes — ships a
**"Support the work"** sponsor link. That is the relay earning its keep
today, in full. It is worth knowing before anybody deletes that page on
austerity grounds: it is the only thing on the box that generates
anything.

What a relay actually has to sell, stated as questions rather than
answers, because this is a product decision and not a technical one:

- **Availability.** Being up is the service. A relay that is reliably
  there is worth more than one that is occasionally faster, and the
  system currently measures neither.
- **Reach.** A node is visible to whoever can see the same relay. A relay
  with more people on it is worth more to be on — which is a network
  effect, and the only one in the design.
- **Its roll.** Under this decision the membership list is an asset, not
  a convenience. Who may be on it is the thing a relay owner controls,
  and the invite is the mechanism that already exists.

**The thing to be careful of.** Every plausible revenue shape pulls
toward keeping something — a record, a queue, an archive, an account with
history. 0006 forbids all of it. So this decision and 0006 are in genuine
tension at the edges, and the tension should be resolved on purpose each
time rather than discovered later: **a relay may charge for carrying, for
being reachable, and for who it admits. It may not start charging for
remembering.**

## Open, and deliberately not decided here

- What a relay sells, and to whom — the owner, or the people on it.
- Whether uptime becomes a published fact. It is what "survive" would be
  judged on, and nothing records it today. The review flagged the same
  gap from the other direction: 0006's whole answer to *"doesn't this
  end asynchronous messaging"* rests on a node being up around the clock,
  and that is also unmeasured.
- `invites.json` — the last non-routing state on a relay. 0006 wanted it
  gone on purity grounds; this decision makes it look like the billing
  hook. Those two readings have to be reconciled before either is acted
  on.
- **Whether a relay's key is pinned by the nodes that use it.** Andy:
  *"anybody can build a crooked relay that pretends to be true… the best
  guard against that is to only use a relay that is somehow certified by
  'self'."* A relay that must earn its keep has to be identifiable across
  time, and today it is not: `answerRelay.js` pins a relay's
  `mailboxPublicKey` **in RAM for one process** and `relays.json` records
  no key at all, so a substituted relay is silent. Worked through in
  [DEVICE.md](../relay/DEVICE.md) §7; it applies to every relay
  interaction, not only to devices.

## Status

Decided. Nothing implemented. It settles one open question from the
Peerlink review and retires one cleanup, which is most of what a decision
is for.
