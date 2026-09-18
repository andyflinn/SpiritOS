# A node and a relay are two different things

**Co-design, 2026-09-18. Verified against `e537880`. Nothing built.**

> **Andy:** *"The node is a digitisation of its owner's spirit — human
> readable, the user-experience expression of the original SpiritOS
> concept. It can afford no dependencies outside native node.js. Relays on
> the other hand are a support framework with a completely different frame
> of existence: low cost, high efficiency. They shouldn't be bound by
> 'human-readable' constraints. And since they're remote, it's not easy to
> look at the files on disk and diagnose what's going on."*
>
> *"I'm dreaming of an almost fully autonomous network of relays, each
> specifically serving #1 its owner and #2 its members — optimising its own
> partnership rolls, reach-optimisation. It can do that better than a human
> operator fairly fast, I claim."*

They have been built from one tree, one commit, one deploy, and have
therefore shared constraints that only one of them ever had a reason for.
This note says which constraints belong to which, what the split makes
simpler, and what it costs.

---

## 1. Most of this is already decided — and correctly scoped

Three of the four halves exist in writing. It is the **code** that has not
followed, because proximity in a tree is not a rule.

**Economics.** [0007](../decisions/0007-a-relay-survives-and-earns-its-keep.md),
amended 2026-09-12, already splits it exactly:

> **Survive** belongs to every server in the system; **earn its keep** is
> the half that is a relay's alone, because a node is paid for by the
> person whose node it is.

And 0007's core carries the scoping clause the rest of this note needs: *"a
feature that does not help it survive or help it pay for itself is not a
feature a relay should have, **however useful it would be somewhere
else**."*

**Readability.**
[STORAGE-PHILOSOPHY](../storage/STORAGE-PHILOSOPHY.md) is about *"the source
of truth for a SpiritOS digital **personality**"*, and closes *"the files
are the personality."* **It never mentions a relay.** The constraint was
always the node's; a relay inherited it by living in the same folder.

**Autonomy has a stated boundary.** [CAPACITY.md](../relay/CAPACITY.md)
already speaks of *"a clear autonomy boundary for partners"* and *"whether
to do so is not a rule; it is a choice the Governor makes."*

**Zero dependencies is stronger than claimed.** `package.json` has no
`dependencies` block at all — not "few", none.

---

## 2. The split, stated

| | node | relay |
|---|---|---|
| what it is | the digitisation of a person | infrastructure that carries for them |
| who pays | the person whose node it is | itself — it must earn its keep (0007) |
| optimised for | inspectability, portability, being understood | low cost, high efficiency |
| on disk | plain JSON, editable in a text editor. **The files are the personality** | whatever is cheapest. Nobody is going to read them |
| diagnosed by | opening the files | **a report it composes for its owner** — §3 |
| evolves | with the person's experience of it | with load, cost and what it learns — §7 |
| **remembers** | **accumulates** — the log is permanent, *"memory is the training set"* (0009) | **forgets** — every store is a recency window against a configured ceiling (§8b) |

The rule underneath: **a relay owes its owner an account of itself, not an
inspectable filesystem.** Those are different obligations and only the first
survives being remote.

### And the split settles arguments about whose question it is

> **Andy:** *"The handling of strangers is a policy problem for the node."*

Worked example, because it came up as an apparent regression and was not
one. When the census sweep went, a stranger who writes to you began arriving
**unnamed** — the sweep had been captioning every member of the relay into
the node's own book in advance.

That reads as a missing relay feature and is a node policy question already
answered: `unknownPolicy` reads the node's own `preferences.json`, set by
the person through `contact.setSenders`, and `frontDoor` acts on it — admit,
acquire, hold, or drop.

**Naming follows the policy decision; it does not precede it.**

| policy | who is there to name |
|---|---|
| drop / silent | nobody — the packet is not filed |
| hold | a row awaiting a human, and the name is wanted *at the moment of deciding* — one search by key, about somebody who actually wrote |
| acquire | admitted, and the name arrives with what they say, or with the label the person types |

So the unnamed row is the correct state, not a gap. The sweep was the node
spending its own budget to caption people its own policy might drop unread —
and a name taken from a survey is a name nobody gave you.

**The general form:** when something looks like a relay shortfall, ask
whether it is a question the node owns. A relay that answered it was
answering on the node's behalf, which is how a support framework ends up
holding a person's decisions.

---

## 3. Readability moves from the disk to the wire

The premise contains a tension, and naming it gives the answer: a relay
should not be bound by human-readable storage, *and* a remote box is hard to
diagnose because you cannot read its files. Both are true, and they resolve
in one direction — **you were never going to read a remote disk.**

So the readable artefact is a **report**, and it already exists:
`relay.statusToOwner` pushes `relayStatus.report` down the owner's own
stream, unasked, to the owner's sink alone.

**It already carries twenty fields**, and the panel that draws it shows
four:

```
at owner mode key version peers present routes meter caps messages
partners invites label expiresAt invitedBy memory rss heapUsed heapTotal uptimeSec
```

— against `Owner, Mode, Peers, Connected`
([natterDetails.js:471-476](../../spirit/run/app/natterDetails/natterDetails.js#L471-L476)).

So "report, not files" is not a thing to build. **It is a thing to finish**:
the wire half exists and the window does not. That inverts today's accident,
where the richest diagnostic surface was the census — readable by every
stranger, and no better for the owner than for them.

---

## 4. The monitor: three panels

> **Andy:** *"The monitor will show an active-member-count, since that's all
> that really matters."* — *"The owner wants to know running activity stats,
> lever positions… exactly current limits."*

| panel | what it answers | state |
|---|---|---|
| **activity** | what is happening — bytes/sec, posts, peak routes, partner fraction, over a 120-slot rolling window | `meter`, **already on the wire, not drawn** |
| **lever positions** | the limits this relay is running under, right now | `caps`, **already on the wire, not drawn** |
| **decisions** | why a lever moved | does not exist, and cannot until levers move |

**No lever moves today.**
`partnerPerMin()` returns `PARTNER_FLOOR_PER_MIN`
([relay.js](../../spirit/run/js/relay.js)) — it is a *function* rather than a
constant precisely so it can move, and it does not yet. Every cap is fixed,
and `caps` reports the same two numbers forever.

So the first two panels are a **UI job against data already arriving**, and
need no relay change at all.

The third is not a separate feature: **it is what a lever position means
once something is choosing it.** A static cap needs no explanation; a cap
that was 600 and is now 200 is unreadable without one. With a human operator
the reasons lived in the operator's head, so nothing had to carry them; with
a Governor they are on the wire or they are nowhere.

Which gives the Governor an acceptance test better than a claim about
speed: **an owner can watch a lever move, read why, and disagree.** A
Governor that cannot be disagreed with is not autonomous, it is
unaccountable.

### Active members, not enrolled

`present` is `Object.keys(sinks)`
([presence.js:143-145](../../spirit/run/js/presence.js#L143-L145)) — free,
and bounded by the connection cap. `peers` is `who()` over the whole roll,
free **only because the roll is resident today**. Under
[CAPACITY.md](../relay/CAPACITY.md)'s activity-scaled memory the roll goes
cold, and the enrolment count becomes a file read while the active count
stays free.

So the number that matters stays cheap and the number that does not becomes
expensive — the census argument one level down. It is also the last
membership-shaped number on the wire:
[0012](../decisions/0012-a-relay-never-asks-for-a-member-list.md) forbids the
list, and a count of the list is its residue.

**Evidence it is the right cut:** `probe` stopped supplying `census.peers`
when it came off the census on 2026-09-18, so the member-facing panel has
rendered `Peers (unknown)` on both live relays since 05:30. Nothing has been
said about it.

---

## 5. Owner sets, relay decides

> **Andy:** *"An autonomous relay still serves its owner: an owner can
> inject permissible/trusted relay-urls and revoke them. That's where the
> partnership boundaries are governed, by a human. The other inputs are
> configuration: RAM-limits specifically."*

| owner sets — human, rarely | relay decides — continuously |
|---|---|
| candidate relay URLs: permit, revoke | which candidates to partner with, and when |
| RAM ceiling | when to drop one |
| | shedding, ranking, label cache, route reach |

**The allow-list is the vouching.** A partnership is a statement of trust —
PARTNERS.md's *"mutual vouchery"* — so a relay choosing partners freely would
be vouching on its owner's behalf for a box the owner never saw. An owner
admitting a **set** and the relay choosing within it keeps the authority with
the human and the optimisation with the machine. **Revocation is a boundary
the relay cannot argue with: the Governor optimises, it never widens its own
world.**

**It also bounds a new capability safely.** Today
**`relay.js` makes no outbound request of any kind** (PARTNERS.md) —
`askPartner` is injected by `server.js`. Autonomous partnering needs the
relay to learn a candidate's key, one `GET /api/relay/key`. Keep the property
by injecting the reach the same way, and the allow-list gives the rule:

> **A relay may only ever reach a URL its owner wrote down.**

Which is the containment `assertRelayUrl` already gives the node. The change
is not "relays can call out" — it is "relays can call out *to a list*".

**Precedent exists for both halves.** Owner writes a file and the relay
notices: `allow.json` plus `reloadAllow()`
([relay.js:440-442](../../spirit/run/js/relay.js#L440-L442)), for members.
Relay reaches out without `relay.js` learning how: `askPartner`, injected.

---

## 6. Partner acquisition gets much simpler

> **Andy:** *"It is also a simplification of partner acquisition."*

**Today a partnership requires the other relay's owner to hold a peer row on
your relay.** `setPartner` opens with `findByKey(peerKey)` and refuses
`no such peer` ([relay.js](../../spirit/run/js/relay.js)), and the
partnership is stored **on that peer row** as `partner: { url, relayKey,
since }`. So two operators who want to partner must first have one of them
join the other as a member, be found in a picker, be verified as that
relay's owner, and be promoted.

Under the allow-list the owner writes a URL. That is the whole of it.

**And PARTNERS.md already specified this shape:**

```
relay-state/partners.json
  "<relayKey>": { url, ownerKey, since, … }
```

A separate store keyed by relay key — not a flag on a peer row. **The
peer-row storage is exactly what forces the membership requirement**,
because a flag needs a row to sit on. The design and the code diverged, and
this simplification is the design side winning, which is a better argument
for it than convenience.

---

## 7. Open: the cost of splitting the evolution

> **Andy:** *"…and a split in evolution for node and relay."*

**This is the one place the split costs something, and it deserves deciding
rather than discovering.**

On 2026-09-18 `answerRelay`'s census fallback was removed on the grounds
that *"a fallback is a reader"* — it kept a cheat alive. Correct for that.
Generalised into "no fallbacks", it makes version skew **fatal**: deploy
relays before nodes, or a node cannot pin and loses search, partner
discovery and front-door recognition.

That is tolerable while the two ship as one commit. **It is not tolerable
once they evolve on separate clocks**, where mismatch is the normal
condition rather than a deploy-window artefact.

So the rule needs splitting:

| | |
|---|---|
| a fallback to a **deprecated** thing | keeps a cheat alive — still forbidden |
| **version tolerance** | a property of the protocol, and currently absent |

Today a node discovers what a relay speaks by receiving a **404**. That
works and it is not a design. Divergent evolution wants additive-only
change, or something that says what a box speaks — and `GET /api/relay/key`
is the natural place, being the first thing anyone asks.

**Cheap now, expensive once the two trees have drifted.**

---

## 8. The first step: RAM limits as configuration

> **Andy:** *"Lab configurations will require RAM-limits, same as relay
> configuration must have."* — *"That will be, likely, the first step:
> officially implementing RAM limits."*

**A relay reads no configuration at all today.** `--port` and the `PORT`
env, and nothing else. Every limit is a constant compiled in —
`ROUTE_WAIT_MS`, `DEVICE_PER_MIN`, `CLAIM_PER_MIN`, `MEMBER_PER_MIN`,
`PARTNER_FLOOR_PER_MIN` ([relay.js](../../spirit/run/js/relay.js)),
`PAYLOAD_MAX` ([limits.js](../../spirit/run/js/limits.js)), `DEFAULT_MAX`
and `DEFAULT_PER_REQUESTER` ([router.js](../../spirit/run/js/router.js)).
`allow.json` is the only owner-written input and it is about members, not
limits.

So a RAM ceiling is **the first configuration a relay has ever had**, and
its shape becomes the precedent for every lever after it. That is why it is
the right first step rather than merely the first useful one.

**Configure the bound, derive the levers.** Nine independent constants,
each guessed separately, is what exists. One configured ceiling with the
rest derived from it is what a Governor needs — it moves derived levers
inside a bound a human set. It is also what makes a lever legible:
`DEFAULT_MAX 256` explains nothing; *"256 concurrent, which is 4 MB of the
64 you gave me"* explains itself, and is a **position** rather than a
number (§4).

**Configuration by verb, not by file — recommended, not decided.** A relay
is already addressable by its owner: `relayLabel`, `removePeer` and
`partner` are owner verbs on `answerSelf`. Setting the ceiling that way
mirrors §3 exactly — **diagnosis by report, configuration by verb, neither
needing disk access on a remote box.** The file precedent (`allow.json`
plus `reloadAllow()`) works only where somebody has a shell, which is the
condition this whole note says not to rely on.

**Two different numbers, and both are wanted.** The *policy ceiling* is
what the Governor sheds against; the *process limit*
(`--max-old-space-size`) is the backstop that makes the ceiling honest. The
reading already exists — the report carries `rss`, `heapUsed`, `heapTotal`
— so what is missing is only the bound.

**And it is what makes the lab real.** A relay with a laptop's memory never
sheds, so a small configured ceiling is the only way to provoke the
behaviour the Governor exists for. Same configuration path as a live relay,
different number.

### The baseline is an entry-level VPS

> **Andy:** *"The first assumption should be entry-level relay."*

**This is already the assumption everywhere and has never been a decision.**
*"On a 1 GB box"* appears in [PARTNERS.md](../relay/PARTNERS.md),
[ROUTE-DISCOVERY.md](../relay/ROUTE-DISCOVERY.md),
[DEVICE-PANEL.md](../relay/DEVICE-PANEL.md) and twice in
[relay.js](../../spirit/run/js/relay.js) — re-derived at each site rather
than referenced, which is how a later reader designs against something
larger without noticing they have moved.

Three things follow from saying it out loud:

- **Defaults are entry-level numbers**, not "whatever the box has". A
  ceiling that defaults to available memory is not a ceiling.
- **The lab relay is the product baseline, not a scaled-down test.** A small
  configured ceiling stops being an artificial condition and becomes the
  ordinary one — which is what makes the verification section honest rather
  than contrived.
- **Anything that only works above entry level is a feature that fails for
  most owners.** That is [0007](../decisions/0007-a-relay-survives-and-earns-its-keep.md)'s
  test applied to sizing: a relay needing a large box cannot be run by an
  ordinary person, which defeats everyone running their own.

**And §10 is what makes this free at the top end.** Because a lever is
`0..1` against whatever its bounds are, the same Governor runs on a 1 GB box
and a 32 GB one with no special casing. A bigger box is a **larger ceiling,
not different behaviour** — so designing for the floor costs nothing above
it, which is usually the objection to designing for the floor.

### DISC_LIMIT is the second ceiling, and the same shape

> **Andy:** *"…and the overall database size bounded against a configured
> DISC_LIMIT for the relay."*

Once the relay has a database (§9b) disk is the other finite resource, and
it takes the same two-part form memory does in §9:

> **Andy:** *"Again, same as RAM: 1) fixed overhead, 2) member roll,
> 3) cache history — 2 and 3 being rolling windows bounded by space
> allotment."*

**Three parts, both resources, the same shape.** An earlier draft had RAM as
*overhead + one workload pool*; it splits the same way, for the same reason
the disk does — route churn would otherwise evict connections.

| | RAM | DISC |
|---|---|---|
| **1. fixed overhead** | executable, V8, process, **monitoring** (§9) | identity and allow — constant, tiny, no life cycle |
| **2. member roll** | the **active** members: sinks and per-connection state | the roll itself, long cycle |
| **3. cache history** | the route working set, label cache | verified routes, by `lastVerified` |

Parts 2 and 3 are rolling windows bounded by their allotment, in both. Part
1 is not a window and has no lever: it is simply there.

**Invites need an allotment as well as a lifetime.**

> **Andy:** *"A standing invite will expire when it's the oldest invite
> bumping against the DISC limit for invites."*

Two earlier drafts filed invites as *self-bounding*, on the strength of
their expiry. Both were wrong, and in the same way: **expiry bounds age, not
quantity.** A thousand invites at fifteen days is still a thousand invites,
so a relay whose owner mints freely accumulates **standing** invites — the
unclaimed ones — until something stops it.

By the rule already stated (*only what grows needs an allotment*), they
grow, so they get one: a space allotment with **oldest-first eviction**.
Which gives the general form the other windows were already obeying without
it being said:

> **A time bound is not a space bound. Every window needs both.**

The cache had this right already — `lastVerified` bounds age, the allotment
bounds quantity — and the roll has it too, with `N` slaved to its allotment.

**And it carries the same social edge as roll expiry.** Oldest-first means
an invite minted for a particular person can vanish because its owner minted
others: one for Alice, then fifty for a workshop, and Alice's is the one
that goes. The allotment working correctly, and it will be reported as a
bug. Worth a warning at mint time rather than a surprise at redemption.

**Invites are a window too, with the shortest cycle of all.**

> **Andy:** *"Invites are bounded by a shorter life cycle than
> membership."*

An earlier draft filed them under part 1 as *self-bounding*, which
understated them — they are bounded by a **life cycle**, and it is already a
complete §10 lever in code
([invites.js](../../spirit/run/js/invites.js), `normalizeDays`):

```js
if (!isFinite(d) || d <= 0) return 7;   // default
if (d < 1) return 1;                    // hard floor
if (d > 15) return 15;                  // hard ceiling
```

Hard floor, hard ceiling, position between, clamped **in one place** so the
signed value and the stored value cannot diverge. Built before the scheme
that describes it.

### Two lever families, and invites are the second

Invites break the pattern usefully. Everywhere else the owner sets bounds
and the Governor picks positions. Here the **owner picks the position** —
seven days for this person, one for that one, because an invite is a
deliberate act about a specific human — and what a relay would want under
pressure is to bring the **ceiling** down from 15.

Which is the monitor-side rule running the other way: *an adjustment narrows
bounds, it does not set positions.*

| | bounds set by | position set by |
|---|---|---|
| **resource levers** — caches, rates, connections, roll expiry | owner | Governor |
| **act levers** — invite lifetime | Governor | owner |

**An act is the owner's to make; its aggregate cost is the relay's to
bound.** Neither reaches into the other's half, which is why the division
survives the inversion rather than being an exception to it.

### n shedding tiers, and n differs by resource

> **Andy:** *"RAM and disc have n shedding tiers, prioritized by
> programming."* — *"n may be different for RAM and disc."*

[CAPACITY.md](../relay/CAPACITY.md) holds the ladder as a fixed list —
*"this cache first, then hint lists and the other performance degradations,
then refuse new claims, and never a partnership."* Two changes to that, and
they do different work.

**"Prioritized by programming" makes the ordering the primary tuning
surface.** Not the levers — the *sequence in which they are pulled*. That
lands on input #1 of the two above: programming is what an owner can shape
now, and lever adjustment comes later. So **the ladder order is what a
Governor is actually told**, and the decision record is what shows whether
the order matches what the owner meant.

**"n may differ" keeps the symmetry honest.** The three-part structure is
the same on both resources; the ladders inside them are independently sized,
and there is a reason they should be: **RAM pressure arrives in seconds and
disk pressure in weeks.** A fast pressure wants graded steps, because a
wrong move is felt at once; a slow one can afford coarse ones, because there
is time to observe between them.

**Two nouns, easily conflated:** a **lever** is a position (§10); a **tier**
is a stage of response that may move several levers at once. A ladder is an
ordered list of tiers, per resource, and its order is policy rather than
structure.

**And the ladders have different *members*, not merely different orderings.**

> **Andy:** *"An invite may live on disc up to n days, but its conversion to
> membership only takes a jiffie of RAM."*

| | RAM | DISC |
|---|---|---|
| invites | a jiffie, at conversion | up to 15 days |
| connections | the main cost | nothing written |
| roll | the active subset | all of it, long cycle |
| route cache | hot working set | full window |

Two of those four exist in only one resource. A disk ladder therefore wants
an invite tier — shorten lifetimes, sweep harder — and a RAM ladder has no
invite tier at all, because there is nothing there to shed. That is why `n`
differs, and it is structural rather than a matter of taste.

### Allotments bound what is held; rate gates bound what is done

The jiffie points at something the three-part model was missing. An invite's
RAM cost is **work**, not state — it is over before anything could be held —
and work is bounded by a **rate gate**, not an allotment.
`CLAIM_PER_MIN = 10` ([relay.js](../../spirit/run/js/relay.js)) already caps
it, and that gate has been sitting outside this structure the whole time.

**But that is only true of RAM.**

> **Andy:** *"Invite conversion is a blip on RAM, but not necessarily on
> disc."* — *"So shedding priorities may differ between RAM and disc."*

On disk the same event is a **commitment**: the invite is consumed out of
the short-cycle window and a roll row is written into the long-cycle one,
where it lives for months. One event, two natures — a jiffie in one
resource, a months-long allocation in the other.

So `CLAIM_PER_MIN` is not merely a CPU guard. **It is the roll's inflow
control**, and the expiry lever is its outflow, which makes them jointly
responsible for the steady state:

```
roll size  ≈  claim rate  ×  retention period
```

The two levers are therefore **not independent**, and roll pressure has two
remedies with very different social costs: **refuse newcomers**, or **evict
the quiet**. Which comes first is a ladder priority — and there is no
corresponding choice on the RAM side at all, because there the event is a
blip with nothing to rank.

**Which is the crispest form of why the ladders differ:** the same event
sits at different rungs in each, because it costs differently in each. Not a
matter of tuning two copies of one list.

### On disk, the expiry lever is slave to the allotment

> **Andy:** *"On disc, expiry lever is slave to disc allotment."*

`N` is not chosen. It is **derived** — §8's *configure the bound, derive the
levers* landing on the sharpest one. Given `roll ≈ inflow × retention`, a
fixed allotment and an observed inflow leave one free variable:

```
N  =  roll allotment  /  (claim rate × row size)
```

So nobody picks "six months"; it falls out of what the owner bought and what
the relay is actually doing.

**And the emergent property deserves saying out loud, because it is not
obvious: growth compresses tenure.** A popular relay forgets its dormant
members faster than a quiet one does, at identical disk spend. That is the
allotment working correctly, and it will still surprise somebody.

**It also gives the plan recommendation a human unit.** Not *"disk is 87%
full"* but *"retention has fallen to three months at this allotment; the
next tier buys nine."* A resource metric restated as the thing the owner
actually cares about, which is what makes it a decision rather than an
alarm.

**And it reduces the roll-pressure choice.** An earlier draft called it a
two-way ladder decision — refuse newcomers, or evict the quiet. With `N`
slaved, **evicting the quiet is automatic**, and the real choice is
three-way: accept shorter tenure, throttle inflow (`CLAIM_PER_MIN`), or buy
disk. Only the last two are decisions.

> **Allotments bound what is held. Rate gates bound what is done.**

So a relay's configuration has two families after all: **ceilings with
allotments**, for state that persists; and **rate limits**, for work that
passes through. `MEMBER_PER_MIN`, `CLAIM_PER_MIN`, `DEVICE_PER_MIN` and
`PARTNER_FLOOR_PER_MIN` are all the second kind, and §8's *derive the levers
from the bound* applies to them too — a rate is a position between a floor
and a ceiling exactly as §10 describes.

**One mental model applied twice** is worth more than either split alone —
the Governor manages one structure with two sets of numbers rather than two
special cases, and a lever added to one resource has an obvious counterpart
in the other.

> **Andy:** *"The configured disc limit needs a split between roll (longer
> life cycle) and cached history (shorter life cycle) — controlled by a
> split allotment of disc resources."*

An earlier draft called the roll *incompressible* and lumped it with
identity. Both halves were wrong.

> **Andy:** *"Identity is fairly constant and very small."*

**Identity and `allow.json` leave the scheme entirely.** They do not grow, so
they need no allotment, no lever and no policy — the disk equivalent of the
executable, budgeted once and never thought about. And `invites.json` sits
nearer them than the roll, because it **bounds itself**: tokens expire and
`sweepExpired` removes them, so nothing has to hold it back.

Which gives the rule that keeps the configuration small:

> **Only what grows needs an allotment.**

The roll and the cache grow. Everything else on a relay's disk is either
constant or self-bounding — and that is the whole of the disk
configuration, which matters because §8 makes this the first configuration a
relay has ever had and the precedent should stay as narrow as it honestly
can.

So the split is **not incompressible versus compressible — it is two windows
at different speeds**, each with its own allotment and its own lever:

| allotment | cycle | what pressure does |
|---|---|---|
| roll | months | shortens `N`, the inactivity drop |
| cache | days | evicts oldest-`lastVerified` |

**And it has to be a split rather than one pool**, because of the failure a
single pool produces: ranking by recency inside one budget means **the
high-churn store always wins**. The route cache turns over constantly and
the roll barely moves, so one busy week of routing would evict *members* —
the slow-moving thing starved by the fast-moving one, which is exactly
backwards.

That is the same reason §9 **reserves** monitoring rather than ranking it:
monitoring is low-churn, workload is high-churn, and one ranked pool sheds
the monitor first every time. So both resources obey one rule:

> **Partition by life cycle. Do not rank across life cycles.**

Each partition gets one lever, bounded, and the two never bid against each
other.

The Governor operates on the second half of each. And the disk cache is
**properly compressible in a way memory rarely is**: a verified route that
is evicted is re-verified on next use, so dropping it costs a round trip
rather than a capability. `lastVerified` supplies the eviction order —
oldest-verified first, the cold end of the same index that gives the hot
one.

**Disk belongs in 0013's ranking, and it is second.**

> **Andy:** *"I've been looking at VPS pricing resources, from most
> expensive down: RAM, DISC…"*

[0013](../decisions/0013-a-relay-is-fixed-cost-per-time-unit.md) ranks three
resources — RAM expensive, CPU and bandwidth cheap — and **does not mention
disk**. It should, and this is the fourth row.

It changes an argument made in this very note. 0013's trade table already
carries *"routes broadcast rather than cached — spend bandwidth, save
RAM"*: it had refused a route cache, because caching cost the dear resource
and broadcasting cost a cheap one. The verified-route cache above puts that
cache on **disk**, which 0013 was not weighing.

With disk ranked second, **the cache is not a cost saving**:

| | costs |
|---|---|
| re-verify on demand | CPU + bandwidth — both cheap rows |
| cache the route | disk — the second-dearest |

So it has to be justified by **latency** instead: re-verification is cheap
for the relay and *slow for the member*. That makes the cache a trade of the
owner's second-most-expensive resource against their members' experience —
the *"#1 its owner, #2 its members"* ordering, priced.

**Which is exactly why `DISC_LIMIT` must be the owner's number** rather than
"whatever the VPS has". It is the dial for how much of their money goes to
their members' speed, and there is no correct default for that.

**Recommended:** amend 0013's resource table to four rows, and note that
"broadcast rather than cache" was decided against a RAM cache, not a bounded
disk one.

**The ordering is an input this design does not own.**

> **Andy:** *"The cost of VPS resources can be researched."* — *"That's
> market research."*

A separate activity with its own output, and rightly outside a design
sitting. What matters here is the seam: **this document owns the shape of
each trade; the coefficients come from elsewhere, dated.** Prices decay, so
a cost model embedded in a principle is wrong within a year, while
*"caching spends the second-dearest resource to buy latency"* stays true
however the numbers move.

The same separation as everything else in this note — bounds against
positions, configuration against choice, and now **coefficients against
structure**. The fourth row enters 0013 on the observation that disk sits
second; the figures behind it can be re-run without touching a single trade
written here.

It is also what [0007](../decisions/0007-a-relay-survives-and-earns-its-keep.md)
is missing. *Earn its keep* cannot be settled from a ranking: a relay that
knows its per-member cost can answer *"what should this cost you?"*, and one
working from three adjectives can only say *"less than the other thing."*

### Backup is a fifth resource, and it splits the store

> **Andy:** *"I currently pay 12 bucks per month, because I included daily
> backup service."*

**Backup is a premium on disk, not a multiplier of it.** An earlier draft
said it doubled the cost of anything stored; Andy: *"backup is about 12% of
the cost, and I bought it preventively."* So it is a modest line item,
chosen as insurance rather than required — and the route cache's arithmetic
is a little worse than §8b stated, not dramatically so.

The sharper consequence is not that disk is dearer than said. It is that
**a cache should never be backed up at all** — it is reconstructible by
definition, which is what makes it a cache. Paying daily to preserve
something that re-verifies itself on next use is waste with no upside.

So the relay's storage splits by **backup-worthiness**, which is not the
same axis as size:

| | contents | backed up |
|---|---|---|
| **durable** | `identity.json`, `allow.json`, the roll, live invites | **yes** — losing these loses the relay's identity and its members |
| **ephemeral** | verified-route cache, meter, decision buffer | **no** — every one of them rebuilds |

**This argues against one database file.** SQLite is backed up whole or not
at all, so co-locating the cache with the roll means paying daily to
preserve a cache. Two stores — one precious and small, one disposable and
large — and only the first is in the backup.

**So the split rests on the principle, not on the figure:** do not pay to
preserve what rebuilds. That is true at 12% and true at 2%, and it is the
kind of reasoning that survives the price changing.

**The property that falls out is worth the split on its own:** backup cost
then tracks **membership only, never activity**. The durable half is bounded
by who joined; everything that grows with traffic costs nothing to protect,
because it is not protected. That is the same *cost tracks this, not that*
discipline as §8b and §9, arriving at a fifth resource nobody had listed.

### RAM binds first; disk is the backstop

> **Andy:** *"And disc will need enlarging much later than RAM."*

An earlier line here said DISC_LIMIT *"finally makes membership finite"* and
left it sounding like an operating constraint. It is a backstop. A roll row
is roughly 150 bytes, so a thousand members is 150 KB and a million is
150 MB, against an entry-level disk of tens of gigabytes — while RAM scales
with **concurrent activity**, which is what actually strains.

So the two ceilings answer different questions, and it is the monitor's
active-versus-enrolled distinction one level up:

| | answers | binds |
|---|---|---|
| **RAM_LIMIT** | how many members can I **serve** at once | first, and continuously — what the Governor sheds against daily |
| **DISC_LIMIT** | how many members can I **hold** | much later — the backstop that eventually refuses new claims |

**A relay's practical size is a service limit, not a storage one.** Which
also says what the Governor will usually be recommending when it reports a
binding ceiling: RAM, nearly always — and that is worth knowing before
building the recommendation, so it is not written as though the two were
equally likely.

### The activity ratio is observed, and it is the sizing coefficient

> **Andy:** *"History will show an observed ratio of disc-based member-roll
> versus average active percentage."*

That ratio is what ties the two ceilings together:

```
roll  ×  activeRatio  ×  per-connection cost   ≈   RAM demand
```

The roll is known and grows slowly; the per-connection cost is measurable;
**`activeRatio` is the only unknown, and it is observable rather than
assumable.** So a relay learns its own sizing formula instead of inheriting
a designer's guess about how many members are online at once — and two
relays with identical rolls and different populations get different answers,
correctly.

**It upgrades the recommendation from a reading to a forecast.** Not *"I am
at my limit"*, nor even *"the next tier costs €X"*, but *"the roll is growing
N a month at R% active — RAM binds in about six weeks."* That is the only
version that arrives **before** the problem, which is the only version worth
having.

**And it closes the split.** A long-run ratio cannot be computed by
something that forgets: the relay's window shows the *recent* ratio, and the
trend needs the permanent record — which lives on the owner's node (§8b).
So the same log that is [0009](../decisions/0009-the-log-is-the-training-set.md)'s
training set is also what produces the sizing forecast. One record, two
jobs, and neither of them the relay's to keep.

### The roll is a window too — and that lever moves people

> **Andy:** *"And the roll should have a drop after n months of inactivity,
> too."* — *"That's a Governor's lever."*

With this, **everything on a relay is a rolling window**, the roll included.
It was the last store that was not one, and it is what makes DISC_LIMIT
bounded by *activity over a period* rather than by cumulative enrolment.

`N` is the lever: short is a tight roll, long is a generous one, between
hard bounds (never 0, which would evict everyone; never infinite, which is
today's unbounded growth). And your framing keeps it out of the shedding
ladder — it is **steady-state hygiene, not a pressure response**. Under
pressure the Governor shortens `N`; it does not evict in a panic.

**But it is the first lever that moves a person rather than a number.**
Every other one adjusts a resource — a cache, a rate, a connection count.
This one un-enrols somebody. `CAPACITY.md`'s ladder already ranks *refuse
new claims* as severe; dropping an existing member is a rung below that, and
the difference deserves to be felt rather than absorbed into an arithmetic.

**Open, and it should be answered before the lever is built.** Expiry is
survivable only if it is recoverable. A dropped member still holds their
key, so re-claiming is the obvious path — except that on a keys-mode relay a
claim needs an **invite**, and an expired member has none. So *drop after N
months* plus invite-only is **permanent exclusion requiring the owner to
act**, for somebody whose only offence was a quiet season.

Candidates, none decided: a grace re-entry for a key that *was* on the roll;
an expiry warning down the member's own stream while they can still act; or
expiry not applying in keys mode at all.

It also reaches other relays — their verified-route caches will point at a
peer that is no longer there. That one is already handled: they re-verify,
fail, and drop the entry (§8b), which is what `lastVerified` is for.

**The far consequence still holds: DISC_LIMIT is what finally makes
membership finite.** The roll is incompressible — a member cannot be evicted to save
space — so as it grows it squeezes the cache, and past some point the limit
binds against enrolment itself. That puts a number behind the shedding
ladder's *refuse new claims* rung
([CAPACITY.md](../relay/CAPACITY.md)), and it is the first principled answer
this relay has to *"how many members can I take?"* — which is a question
[0007](../decisions/0007-a-relay-survives-and-earns-its-keep.md) asks it to
be able to answer, since a box that cannot say what it costs cannot earn its
keep.

### The databases are rolling windows

> **Andy:** *"Automatically shedding longest-idle connections to keep within
> disc limits."* — *"So the databases are rolling windows over as much recent
> past as is bounded by disc limit."*

**One ordering, several tables, two pressures.** Longest-idle first is the
eviction rule everywhere: connections by idle time, roll rows by
last-active, routes by last-verified. The pressure differs — connections
cost RAM, tables cost disk — but the order does not, and the two are coupled
through the same index: an idle connection keeps a member counting as
*active*, which holds their row at the hot end. Drop the connection, the row
ages, and it ages out of the window.

So a relay's stores are not archives with a cleanup policy. **They are
windows over as much recent past as the ceiling affords**, and the tail
falls off because there is nowhere for it to go.

**This is already true of the relay's most obvious store.** `trafficLog`
writes nothing in relay mode — `if (relayMode …) return null`
([trafficLog.js:283](../../spirit/run/js/trafficLog.js#L283)) — so *"the log
should be permanent. period."* is the **node's** rule and the relay was
exempted from it before this note existed. The generalisation is not a new
constraint; it is the one the relay already follows, extended to the tables
it is about to grow.

Which gives the split its sharpest line:

> **The node accumulates. The relay forgets.**

### So the decision record is not a relay store either

> **Andy:** *"Does the relay really need a json log?"* — *"Nodes are the
> keepers of that."*

It does not, and it never had one. And what a relay *does* persist is all
**current state, never history**: `allow.json`, `identity.json`,
`invites.json`, `routingTable.json` — who may join, who I am, which tokens
are live, who holds a row. Not one is a record of what happened.

**That settles the last thing §4 left open.** The Governor's decision record
does not live on the relay: the relay **emits** a decision down the owner's
stream as it makes it, and the owner's node **keeps** it.
[0009](../decisions/0009-the-log-is-the-training-set.md) is why that is the
right home rather than merely a possible one —

> Not a log that forgets — a spirit that does.

— the node's log is permanent and append-only, and 0009 calls it *the
training set*. The Governor is precisely what would be trained on it. So
decisions accumulate where memory belongs, and the relay stays a box that
forgets.

It also shrinks §9: monitoring needs a **buffer**, not an archive — sized by
how long a disconnect is tolerable, not by how much history is worth
keeping.

### And the records are the Governor's training set, already in the owner's hands

> **Andy:** *"An owner should be able to download decision records to
> optimise the Governor's behaviour."*

**No download is needed, which is the payoff of the previous section.** The
records land in the owner's node log —
[0009](../decisions/0009-the-log-is-the-training-set.md) made that permanent,
append-only and *readable* for precisely this reason. Had they stayed on the
relay, "download" would have meant a new verb, a new door, and a size
question; on the node they are a file the owner already holds on a machine
they already own. **"The log is the training set" stops being a metaphor.**

### Downloading the history: why "GET gated by owner key" is hard

> **Andy:** *"There will be GET interfaces to download current snapshots of
> the Governor-history, the GET interfaces gated by owner key."* — *"It's
> the relay's GET rules, not the node's."*

An earlier draft of this section answered by moving the download to the node.
That sidesteps rather than answers: the question is about the **relay's** GET
surface, and it deserves an answer there.

**The obstacle is not 0010's exemption count. It is that a link cannot carry
a header.**

This relay permits a signature in exactly one place — `X-Spirit-Sig` — and
refuses a query `sig` outright, because *a signature on a query string is
already in an access log*
([relay.js](../../spirit/run/js/relay.js), `streamSignatureFrom`). A browser
following a download link sets no headers. So *"GET gated by owner key"* is
not directly buildable: **the gate cannot ride where the rule requires it,
and the one place a link can carry something is the place the rule
forbids.**

Two ways round it, and this codebase has a precedent for each:

**A capability URL, not a signature.** The owner *posts* for a snapshot and
receives a short-lived, single-use path; the browser follows that. It is the
shape of the key-addressed enrolment page 0010 already grants — a locator
that grants nothing by itself — and a short-lived token in an access log is
a much smaller problem than a signature in one. One grant, of a kind already
made, for the same reason.

**Or the node fetches it.** The owner's browser talks to the owner's node;
the node holds the key and can set headers; the relay stays a signed-post
surface and grows no GET. The browser still gets its file, from the machine
that was always going to hand it over.

The second needs nothing new. The first needs one grant. **Neither needs a
signed GET**, which is the thing that cannot be built as stated.

### And such a path need not be public

> **Andy:** *"And GET paths for that don't have to be public."*

Correct, and the mechanism is already in the tree. `isRelayPublicPath` is
not "public" in the sense that matters — it is *reachable, then gated by its
own handler*; the stream is on that list and is the most authenticated thing
on the box. Anything **not** on it is `404` before dispatch.

And the list takes **patterns**, not only literals:

```js
const DEVICE_PAGE_PATH = /^\/([A-Za-z0-9_-]{16,512})\/device$/;
if (method === 'GET' && devicePageKey(pathname)) return true;
```

So a token-addressed history path needs no new machinery: same shape, same
allowlist, and a path that does not match does not exist.

**The one distinction to make rather than inherit.** The device page's token
is *"a locator, not a credential: every key here is already public… holding
one in the URL grants nothing. What authorises is the password."* A history
token **is** the credential — which is what got a query `sig` refused, since
a URL lands in every access log it passes.

What makes it acceptable is **single-use and short-lived**: a logged token
is already spent by the time anyone reads the log. That is a real
mitigation, and it is a *different* argument from the device page's, so it
has to be made on its own rather than borrowed.

**Worth keeping in view:** by the previous section the history accumulates
on the owner's node anyway, so a relay-side snapshot covers the case where
the node was away and missed some — catch-up. And catch-up has an answer
here already: `GET /api/hub/arrivals` was deleted because *"a page that was
closed catches up on the SAME live channel … a second door asking a weaker
version of an answered question."*

### Two inputs to the Governor, and only one is for now

> **Andy:** *"The Governor's behaviour has two potential inputs: programming
> AND monitor-side lever adjustments, which are more tricky and for
> later."*

| input | when |
|---|---|
| **programming** — the policy that decides how levers move | now |
| **monitor-side lever adjustment** — the owner moving one by hand | later |

**Half of the second may be less tricky than it looks.** If an adjustment
**narrows bounds** rather than **setting a position**, §5's division holds
unchanged: the owner's half stays *"what are you allowed"*, the Governor's
stays *"what do you pick"*. Pull a ceiling to 6/12 and the Governor
optimises within 0–6/12, with nothing to arbitrate.

An override of a *position* is what breaks it — the Governor either obeys
for ever (and is not autonomous) or moves it back (and the owner's action
evaporates). Neither is a good answer, and neither has to be given if
adjustments are bounds.

**What stays genuinely hard** is whether the Governor should *learn* from
the adjustment — treating *"the owner keeps pulling this down"* as a signal
rather than only as a constraint. That needs the decision records to exist
and to have been read, which is why it is second.

**Open, and it deserves a deliberate answer.** §4's acceptance test is *"an
owner can watch a lever move, read why, and disagree."* An owner whose node
is away loses every decision past the buffer. That may be correct — a
decision nobody witnessed is one nobody can disagree with, which is the same
shape as presence being true only while a socket is open — but it means
**the relay's account of itself is only as good as its owner's attention**,
and that should be chosen rather than defaulted into.

And it gives [0006](../decisions/0006-fast-and-true-not-guaranteed.md) —
*a relay stores nothing on anyone's behalf* — a **mechanism instead of a
promise**. Not a rule somebody has to keep remembering, but a shape in which
long-term memory has nowhere to live. Structural rather than enforced, which
is the form this codebase prefers a rule to take.

### The ceiling is a purchase, and the relay knows when it binds

> **Andy:** *"The VPS plan is adjustable."*

Everything above treats a ceiling as fixed and the Governor as shedding
inside it. But the plan can be changed, which makes the ceiling a **purchase
decision** — and the relay is the party best placed to know when it is the
binding constraint.

So there is a lever the Governor does not move: it **recommends**. A relay
that can say *"I have been shedding at this ceiling 40% of the past week,
and the next tier costs €X"* has handed its owner a decision. One that can
only say *"I am at my limit"* has handed them a complaint.

**This is what makes [0007](../decisions/0007-a-relay-survives-and-earns-its-keep.md)'s
*earn its keep* operational** rather than rhetorical. Earning its keep is not
only costing little; it is being able to say what more would cost and what
it would buy — which needs the cost model (§8b) and the decision record (§4)
to exist, and is a third thing they are jointly for.

It also gives the monitor a job beyond display: a lever pinned at its
ceiling for a sustained period is not a reading, it is **a recommendation
waiting to be surfaced**.

**So configuration is a set of resource ceilings, not a list of knobs.**
Each is a bound the owner sets and the Governor works inside, and the same
three rules apply to both: reserve what must not be shed, derive the levers
from what is left, and report the position (§4, §10).

## 9. Then: monitoring is overhead, not workload

> **Andy:** *"First RAM limits, then reserved RAM space for monitoring."* —
> *"The service to the monitor must be bounded, so the observed relay
> activity only gets exactly the space that is reserved for these types of
> things: executable-in-RAM, process overhead, etc."*

**Reserved, and bounded.** Two rules, and together they put monitoring in a
category rather than in the shedding ladder:

> Monitoring is **process overhead, not workload.** It belongs with the
> executable and the interpreter — a fixed cost of being a relay at all,
> which neither grows with members nor shrinks under pressure.

That makes the configured ceiling arithmetic instead of a guess:

```
configured ceiling
  ├─ overhead   executable, V8, process, MONITORING   fixed, measured, reserved
  └─ workload   connections, partners, search slots, caches   the shedding pool
```

The Governor operates on the lower half only. **It cannot shed monitoring to
survive longer, and cannot grow it to see better** — which closes both
failure modes: a relay that goes blind exactly under the load worth
watching, and one that spends its owner's memory watching itself.

**Half of this is already in the code, for one component.** `meterFloor`
holds the meter to `METER_SLOTS_MIN` slots and a minimum span
([relay.js:346-362](../../spirit/run/js/relay.js#L346-L362)), with the
reason stated exactly: *"which is what stops 'smaller and slower' becoming
'blind'."* It has a floor and no ceiling. Under this rule it would have
both, and so would everything else the monitor keeps.

**The new consumer is the decision record.** §4's third panel needs
somewhere to put what the Governor chose, and that somewhere has to survive
the pressure that produced the choices — a decision log shed under load
erases precisely the entries worth reading. Bounded, so it cannot grow
without limit either: within the reservation, the meter's floor and the
decision record compete, and that competition is a design question rather
than an allocation accident.

**Why it comes second and not first.** A reservation is a fraction of a
ceiling, and there is no ceiling until §8. Doing them the other way round
reserves a share of a number nobody has set.

## 9b. The roll wants an index — and it needs no foreign dependency

> **Andy:** *"The relay will have an index of the member roll by most
> recently active… there is my anticipation of a disk-based SQL-type foreign
> dependency."*

The index is what makes [CAPACITY.md](../relay/CAPACITY.md)'s *"RAM scales
with activity"* implementable rather than aspirational: **point lookup by
key** for verification, **an index on last-active** for the hot end, and a
cold tail that is never read. Without it, "only keep active members in
memory" still costs a whole-file scan to answer *"is this key a member"*.

**And the foreign dependency is not needed.** `node:sqlite` is a **core
module** since Node 22.5 — `require('node:sqlite')` sits with `require('fs')`.
Verified working on v24.20.0 at the time of writing: `DatabaseSync`, a
`PRIMARY KEY` lookup, and an index on a recency column.

So *"no dependencies outside native node.js"* holds for **both** sides. §2
gives the relay permission to diverge on this; it does not have to be spent
here.

What it costs instead is one number: `package.json` declares
`"node": ">=18"`, and this wants 22.5+. A floor move is a much smaller thing
to defend than a dependency, and it can be the **relay's** floor rather than
the whole repo's — which is itself the split doing work.

**The node is untouched.** [STORAGE-PHILOSOPHY](../storage/STORAGE-PHILOSOPHY.md)
is about the personality, its plugin doctrine says alternative backends
*"belong in plugins, never in the core"*, and a relay's member roll is not a
personality. The files are still the personality; the roll never was one.

### Partners want an index too — and there it is a defence

> **Andy:** *"So both the relay's member roll and the relay's partner index
> will be indexed, to serve the relay's efficiency."*

Partners live **inside the member roll** today, as a flag on a peer row, so
every partner lookup is a scan of the membership:
`partnerByRelayKey` calls `listPeers()` — which *allocates an array of every
member* — and walks it for a handful of partners
([relay.js:820-829](../../spirit/run/js/relay.js#L820-L829)).

That is on the hot path. `partnerIdentity` is the fallback half of
`deviceIdentity(token) || partnerIdentity(token)`, at both `routePost`
([relay.js:2650](../../spirit/run/js/relay.js#L2650)) and `streamOpen`
([relay.js:3275](../../spirit/run/js/relay.js#L3275)). And `deviceIdentity`
itself falls back to scans: `findByKey` scans when the map misses,
`findByLabel` always scans.

**So an unknown token costs three full passes over the membership, with
three array allocations — and is not rate-limited**, because the gate keys
on `who.id` and resolution has to produce it first:

```js
var who = deviceIdentity(fromToken) || partnerIdentity(fromToken);
if (!who) return { ok: false, status: 403, error: 'no such identity' };
// the rate gate comes after this
```

One small packet in, O(members) work out, from an unauthenticated caller,
growing with the relay's success. That is
[0013](../decisions/0013-a-relay-is-fixed-cost-per-time-unit.md)'s own test
answered the wrong way.

Negligible at a handful of members; at a thousand it is roughly three
thousand comparisons per junk packet. **The index removes it as a side
effect** — key, label and partner lookups all become index hits, so an
unknown token is refused in constant time.

Which reframes what indexing is for: on the member roll it makes cold
storage possible, and **on partners it is a defence**. It also converges
with §6 — moving partnerships out of the peer row is what removes both the
membership requirement *and* the scan, one change and two results.

**Not touched.** `relay.js` gates are a stop-and-call-a-team-review line
(CLAUDE.md); this records the finding and decides nothing.

### Lazy: nothing is resident that traffic has not asked for

> **Andy:** *"It will be the cached partner-hints (routing hints) that
> accompany a peerPost() that then trigger inquiry into the partner table,
> before a partner is even loaded."* — *"Lazy load everything to conserve
> RAM."*

**This answers a question the code left open by name.** `routePost` takes
`atRelayKey` and says of it:

> the one thing this function takes that **NOTHING ON THE WIRE SUPPLIES**. It
> names which partner holds the target… while **the question of how a node
> tells a relay that stays open** (0012 says the node has the answer; a post
> has no field for it).
> — [relay.js:2607-2617](../../spirit/run/js/relay.js#L2607-L2617)

Three pieces designed separately turn out to be one mechanism:

| | |
|---|---|
| the parameter | `atRelayKey`, already named *"which partner holds the target"*, unwired |
| the wire shape | routing hints as **siblings** of the packet, signed separately, consumed and dropped by the first hop ([SURFACE.md](../relay/SURFACE.md) §8) |
| the index | what `atRelayKey` is a key **into** |

So a hint is not only routing. **It is the lookup key that warms exactly one
partner row**, and no partner is resident until a packet names one. The
requester supplies the index key — [THE-REQUESTER-IS-RESPONSIBLE](THE-REQUESTER-IS-RESPONSIBLE.md)
applied to loading rather than to asking.

**What stays resident, then:**

| | why |
|---|---|
| live sockets | they are the connections; there is nothing to defer |
| the monitoring reservation | §9 — overhead, not workload |
| whatever the current packet warmed | transient, and bounded by the packet |
| **nothing else** | the roll, the partners, the labels: cold until named |

**And §9b is what makes this cheap to build.** With the index in
`node:sqlite`, the hot pages are the OS page cache — memory the kernel
manages and reclaims — rather than a heap this code has to evict from.
"Lazy load everything" then needs no cache manager written, which is
usually the reason lazy loading does not get done.

It works in both directions, and one of them is the defence above:
**outbound**, a hint names the partner and one row is read; **inbound**, a
`fromToken` is an index lookup rather than three scans, so an unknown sender
is refused in constant time.

### Verified routes are worth persisting; referrers are not

> **Andy:** *"The partner table in the relay's database may have a fan-out
> for node-IDs that need them for routing."* — *"Caching verified route
> hints in a database makes eminent sense."*

Two structures hide in that, and only one wants a database.

| | shape | where | why |
|---|---|---|---|
| **verified routes** | `peerKey → relayKey`, `lastVerified` | **database** | durable, earned, **no referrer**, bounded by traffic actually carried |
| **the shedding fan-out** | which loaded partners a connected member is using | **RAM** | shedding only ever concerns what is already loaded; an entry for a cold partner describes a decision that cannot be taken |

> **Andy:** *"…with a last-verified time-stamp in the database."*

**That field is what makes the cache honest rather than merely fast**, and
it earns its place four times over:

- **Trust decays.** A route verified an hour ago is a fact; one verified six
  months ago is a guess. Without the stamp there is no way to tell a working
  route from one nobody has tried since it broke.
- **It gives eviction an order.** A database grows, so the cache must be
  bounded — and oldest-verified-first is the obvious cut, for the same reason
  the roll's hot end is the useful end.
- **It is the same shape as the roll's index.** Roll by last-active, routes
  by last-verified: one pattern, two tables, and both give a hot end and a
  cold tail (§9b).
- **It answers a question [ROUTE-DISCOVERY](../relay/ROUTE-DISCOVERY.md)
  left open** — the staleness signal — and makes a *negative* result
  cacheable too: *"K was not at B, as of T"* is only useful with the T.

**And it is written by success, not by use.** A forward that works *is* the
verification, so `lastVerified` and "last known good" are the same fact and
cannot drift apart. A failed forward does not refresh it, which is what lets
a broken route age out instead of being kept alive by being tried.

**"Verified" is what makes persistence safe.** An unverified hint is a
claim, and a claim cached durably is a **durable lie** — the harvest vector
[ROUTE-DISCOVERY](../relay/ROUTE-DISCOVERY.md) leaves open, a partner
asserting keys it does not hold. A cache of *outcomes* cannot be poisoned
that way: a lie is never written because it never succeeds.

**And storing the route rather than the referrer answers the privacy
half.** `peerKey → relayKey` says where a peer lives. `memberKey →
partnerKey` would say who talks to whom, and that is a correspondence graph
that survives restarts. The tree already refuses the same shape in the other
direction, keeping route chatter out of a node's log because it *"would
leave, on every member's disk, a lasting record of what a relay's members
have been looking up"* ([server.js](../../spirit/run/js/server.js)).

### This amends 0013's "never persisted"

[0012](../decisions/0012-a-relay-never-asks-for-a-member-list.md), amended
by [0013](../decisions/0013-a-relay-is-fixed-cost-per-time-unit.md), permits
a **working set in RAM** and refuses a stored one — *"no stored term, and no
verb that fetches one"* — on this reasoning:

> **never persisted** — a relay that reboots is re-primed by its members'
> next requests, so boot stays `O(own members)`

**That is an argument about resident memory at boot, and the index removes
it.** With a lazy store, persisted no longer means loaded: a verified route
is read when a packet names it and not before (see above). So the sentence
that should survive is the one about *fetching* — no verb that asks another
relay for a list — and the ban on storing what this relay proved for itself
can go.

**Recommended, not decided**, because it amends two decisions: the rule
becomes **no fetched term, and no stored referrer.** A relay may keep what
it has verified about where peers are; it may not keep who asked.

**Open:** whether the roll moves wholesale or the index is kept beside the
JSON. `routingTable.json` is read whole at boot today, and
[CAPACITY.md](../relay/CAPACITY.md) marks persist-shape work as a
stop-and-call-a-team-review line. This note records that the dependency
objection does not apply; it does not decide the store.

---

## 10. What a lever is

> **Andy:** *"All levers go from 0 to on, quantized into 1/3rd or 1/12th if
> the lever has a limited number of states."* — *"because levers are an
> evolving system"* — *"if zero represents hard-floor and 1 represents
> hard-ceiling?"*

**0 is the hard floor. 1 is the hard ceiling. The position between them is
the Governor's.** Quantized to **thirds** when coarse and **twelfths** when
fine, chosen so the two nest: 12 divides by 3, so a fine lever expresses a
coarse one exactly rather than approximating it.

That sentence unifies three sections. The **bounds are configuration** —
what the owner set, §5 and §8 — and the **position is the choice** the relay
makes inside them. One vocabulary for *"what am I allowed"* and *"what have
I picked"*.

### Why normalised, and it is not tidiness

> **Andy:** *"because levers are an evolving system"*

Levers get added, retired, and change what they mean. A normalised position
means the monitor, the decision record and the Governor **do not change
shape when that happens** — a new lever is a new row, not a new unit for
every consumer to learn. Raw units couple every reader to every lever.

Four more things follow:

- **Uniform.** A rate and a cache size read alike, with no conversion.
- **Comparable.** *"Partner allowance 4/12, cache 11/12"* says at a glance
  which levers are near their limits. Absolute numbers do not.
- **Enumerable.** Thirteen positions, not a continuum — which is what makes
  a decision loggable in a line (*"partner allowance 6/12 → 4/12, rss 78%"*)
  and §4's third panel writable at all.
- **Tractable.** A live-trained governor over a bounded discrete action
  space is a small problem; over continuous levers it is not.

### What hard-floor-at-0 fixes, which "off at 0" did not

An earlier draft of this section read 0 as *off*, and had to carve out an
exception for levers that must never reach zero. The tree has the case, and
it is a deadlock rather than a preference
([relay.js:162-178](../../spirit/run/js/relay.js#L162-L178)):

> **IDLE MEANS FLOOR, NEVER ZERO** … a pool of zero is a bootstrap deadlock.
> An unused partnership could never carry the first packet that would make
> it used, so the fraction could never rise, so the pool would stay zero for
> ever.

With 0 as the hard floor the exception disappears. The partner lever's hard
floor **is** that floor, so position 0 means 60/min and the deadlock is
impossible by construction. A lever whose hard floor genuinely is zero — a
cache that may be switched off — gets zero at 0. **Same scale, different
bounds, and the difference lives in each lever's declaration rather than in
the rule.**

`PARTNER_FLOOR_PER_MIN = 60` becomes that lever's declared floor, which its
own comment invites: *"the starting declaration, in force until there is
something to divide — not a constant anybody chose as correct."*

**Open:** how today's nine constants become bounds. `MEMBER_PER_MIN 600`
against a partner floor of 60 is a tenth, which is not a clean twelfth — so
either the quantum or the numbers move. A question for whoever derives them
from the ceiling (§8), not one to settle here.

---

## How this gets verified

> **Andy:** *"The test environment demands: you populate member rolls on two
> relays via local ports, and I check how observable they are on my
> monitor."*

Stated as a requirement on the work, not as a fixture to build yet.

Two relays, local ports, real member rolls, and the question asked of the
**monitor** rather than of a file. That is the right test precisely because
it exercises the thing that replaces readable storage: if the rolls are not
observable there, §3 has failed, and no amount of correctness on disk
compensates.

**The constraint that makes it non-trivial**, and that any fixture has to
satisfy: `relayStatus.report` is pushed by `statusToOwner` to the **owner's
sink alone**. So the observing node must *own* both relays and hold a stream
to each. A fixture that populates two boxes and then looks at them some
other way has tested the rolls and not the monitor.

Two relays rather than one is the load-bearing part: it is what catches a
panel reading a shared value instead of its own relay's. Different roll
sizes on the two would make that failure visible at a glance.

`labMaster` can already run relays on local ports — a row with
`type: 'relay'` is spawned with `--relay`
([labMaster.js:541](../../spirit/test/labMaster/labMaster.js#L541)) — and
`playPopulate.js` already enrols a roll the honest way, minting an invite
per key and consuming it, with labels that collide the way real names do.
So the pieces exist; what is not decided is which node owns the two relays,
and how large each roll should be.

## Decided

**The two frames.** A node is a person and is readable because of it; a
relay is infrastructure and **owes its owner an account of itself, not an
inspectable disk**. Readability is the node's constraint, scoped by
STORAGE-PHILOSOPHY's own words.

**The node accumulates; the relay forgets.** Every relay store is a rolling
window. Its log already was — `trafficLog` writes nothing in relay mode —
and the roll is the last one to become one.

**Resources have one shape, applied twice:**

| | RAM | DISC |
|---|---|---|
| 1. fixed overhead | executable, V8, process, monitoring | identity, allow |
| 2. member roll | active members | the roll, long cycle |
| 3. cache history | route working set, labels | verified routes, short cycle |

- **Partition by life cycle; do not rank across life cycles** — or the
  high-churn store starves the low-churn one.
- **Only what grows needs an allotment.** Identity is constant; invites
  bound themselves by expiry.
- **Allotments bound what is held; rate gates bound what is done.**
- **Monitoring is overhead, not workload** — reserved and bounded, so it can
  be neither shed to survive nor grown to see better.

**Levers.** `0` is the hard floor, `1` the hard ceiling, the position
between them is the Governor's, quantized in thirds or twelfths so the two
nest. Bounds are configuration; positions are choices. Two families:
**resource levers** (owner bounds, Governor positions) and **act levers**
like invite lifetime (Governor bounds, owner positions).

**Shedding.** Each resource has its own ladder with its own `n`, its own
members and its own order — the same event sits at different rungs, because
it costs differently in each. Order is programming, and programming is the
tuning surface that exists now.

**The owner governs partnership boundaries** by an allow-list of relay URLs,
permit and revoke; the relay chooses within it. Revocation is a boundary the
Governor cannot argue with.

**The baseline is an entry-level VPS**, already assumed everywhere and never
written down. RAM binds first; disk is the backstop.

**Stranger handling is the node's policy question**, not a relay shortfall.

## Recommended, not decided

**Build order.**

1. **RAM limits** (§8) — the first configuration a relay has ever had, and
   the precedent for every lever. Configure the bound, derive the rest, and
   set it by an **owner verb** rather than a file so nothing needs a shell.
2. **Reserve monitoring out of it** (§9).
3. **DISC_LIMIT**, split by life cycle into roll and cache allotments.
4. **Draw the two monitor panels** whose data already arrives — no relay
   change at all.

**Amendments this sitting proposes to existing decisions**, and the reason
they are listed separately: each changes a rule rather than adding one, and
none is mine to take.

- **0012 / 0013** — from *"never persisted"* to **"no fetched term, and no
  stored referrer."** The boot-cost argument behind "never persisted" is
  dissolved by a lazy index; the privacy half is answered by storing routes
  rather than referrers.
- **0013's resource table** — a fourth row. Disk sits second, and *"broadcast
  rather than cache"* was decided against a RAM cache, not a bounded disk
  one.
- **0007** — *earn its keep* cannot be settled from a ranking. It needs the
  cost model, which is market research and lives elsewhere, dated.

**Structural.**

- Partnerships move to `partners.json` keyed by relay key, as PARTNERS.md
  already specifies — which removes the membership requirement *and* the
  scan.
- Inject the candidate reach the way `askPartner` is injected, so `relay.js`
  keeps its no-outbound property.
- Two stores, not one: the backup covers the durable half only.
- `node:sqlite` is a core module, so the index needs no foreign dependency —
  only an engines floor of 22.5, and it can be the relay's floor alone.

## Open

- **Version tolerance** (§7) — the cost of the evolution split, and the one
  thing that gets harder the longer it is left.
- **Expiry must be recoverable.** *Drop after N months* plus invite-only is
  permanent exclusion for somebody whose only offence was a quiet season.
  Answer before the lever is built.
- **Roll pressure is a three-way choice, and only two parts are decisions.**
  Expiry is slaved to the allotment, so shorter tenure happens by itself;
  what remains is whether to throttle inflow or buy disk. *Growth compresses
  tenure* is the property to warn an owner about.
- **An owner who is away** loses decisions past the buffer, and §4's
  acceptance test is that an owner can watch a lever move and disagree.
- **One tree or two.** Divergent evolution in one repository is a
  discipline; in two it is a fact.
- **What a decision record looks like** — it cannot be designed before a
  lever moves.
- **The Governor itself.** [CAPACITY.md](../relay/CAPACITY.md) holds that
  work; nothing here changes it except to say what it owes the owner: a
  lever position, and a reason.

## Or not

The honest alternative is to keep one frame and accept a relay that is more
expensive and more inspectable than it needs to be. That costs the dream in
§5 and almost nothing else today — the relays are small, the operator is the
author, and a human reading files is a workable diagnosis at this size.

**What waiting costs is §7**, and only §7: every week the protocol is not
skew-tolerant is a week of coupling that a split will have to pay off later.
Everything else here can be taken up whenever it is worth doing.
