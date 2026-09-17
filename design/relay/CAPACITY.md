# A relay governs itself by what it can observe

**First cut, 2026-09-17. Nothing here is built.** Every claim about the tree
was checked at `97e973e`. This is written to be argued with: *decided*,
*recommended* and *open* are kept apart, and the one measurement that
surprised its author is called out rather than buried.

> **Andy:** *"a relay's capacity is primarily governed by its own RAM and
> by its network bandwidth."*

That sentence is the whole document. Everything below is what follows from
taking it literally: if capacity is RAM and bandwidth, then a relay can
*measure* its own capacity, and a limit it measured is worth more than a
limit somebody typed.

---

## Why this is live now

Two things arrived together.

**The conduit decision** (PARTNERS.md, *"acquisition is the gate"*): relays
forward across a partnership and the recipient node gates by identity. That
widens the population who may knock at a node's door from *members of my
relays* to *members of my relays ∪ their partners' members*.

**And a cost this author overstated.** That section said the relay's
concern "moves from consent to abuse" and owes a rate story. Andy:

> *"spam and abuse can also happen between two peers on the same
> relay-ledger."*

Correct, and it makes the point sharper than it was. The node-side floor is
already global rather than per-sender — `unknownBytes` is **one array
summed across everybody** ([peerPost.js:143](../../spirit/run/js/peerPost.js#L143))
— so the ceiling on what strangers can make a node write **does not move
when the stranger population grows**. Ten thousand partner-members share
the same 64 KB/min that two do. Widening reach cannot touch that number.

So this is not a debt the conduit decision created. It is a gap that was
always there, and the conduit decision is only what made it worth looking
at.

---

## What is actually there today

Measured by reading, at `97e973e`.

| guard | value | where | scope |
|---|---|---|---|
| claim attempts | 10/min per caller | `relay.js:769` | per relay |
| device enrolment | 10/min per identity, **named in the refusal** | `relay.js:1189` | per relay |
| payload size | `PAYLOAD_MAX` 16384 | `limits.js` | per packet |
| unknown sender, requests | 6/min **per stranger** | `peerPost.js` | per node |
| unknown sender, payload | 65536/min **across all strangers** | `peerPost.js` | per node |

### The finding: there is no rate limit on posting

> **Refined 2026-09-17 by building it.** "No limit" was too strong, and the
> distinction turns out to be this document's own: **a stock limit existed
> and a flow limit did not.**
>
> `routes.open` already caps a requester's **outstanding** posts — `too
> many in flight`, 429, `DEFAULT_PER_REQUESTER = 16` — and the table caps
> the box at `DEFAULT_MAX = 256`. That is the RAM half of recommendation 1,
> **built, and already fair per requester.**
>
> What was missing is the flow half. A post that completes promptly costs
> nothing against a stock limit, so a polite, fast, endless conversation
> was bounded by nothing at all. Found by writing `relayMeter.js`: a naive
> flood loop was stopped at sixteen by the in-flight cap, which has nothing
> to do with rate.
>
> **Now built:** `ROUTE_PER_MIN` on `routePost`, keyed on the resolved
> sender, naming its number in the 429; and the meter beside it — a fixed
> ring of bytes, posts and peak routes per second, aggregate, carried to
> the owner in `relayStatus`.

`rateOk` has exactly **two** call sites — claim and device enrolment.
`routePost` has none. A member may post as fast as they can open sockets,
and the only thing bounding it is the destination node's floor, which
applies **only to senders it has never heard of**. Between two acquainted
peers there is no rate limit anywhere in the system.

The "30 sends per minute per key" that reads like a live rule
([relay.js:259](../../spirit/run/js/relay.js#L259)) is a comment about
`send`, the ring route R8 deleted. The reasoning in it is worth keeping —
*"keying on the claimed name made the limit meaningless: 30 per minute per
made-up string, and rotating the string resets the budget"* — but the limit
it describes does not exist any more.

**So this proposal is not tightening anything. It is the first relay-side
limit on the thing that moves bytes.**

### And what the relay already knows about itself

`relayStatus.report` already carries `routes` — *"posts registered and not
yet answered … the number that says whether this relay is BUSY as opposed
to merely populated"* — and `memory.rss`, with the note that **rss is the
honest figure** because heapUsed flatters on a box that is mostly sockets.

Both are already streamed to the owner. Nothing new has to be measured to
start.

---

## Decided (Andy)

0. **A relay's resource usage is driven by member demand.**

   > **Andy:** *"relay's resource usage driven by member demand."*

   Numbered zero because the rest follows from it. **A relay spends nothing
   in anticipation.** Everything it holds is the trace of something a
   member actually asked for — a route exists while a post is in flight, a
   presence entry while a socket is open — and when nobody is asking, it
   holds its own ledger and nothing else.

   **The test this gives every future proposal:** *does this consume
   memory before anybody asked for anything?* If yes, it is wrong.

   It explains, in one rule, decisions that were each argued separately:
   no partner rosters, no hint lists, no cached descriptions. And it is why
   two relays on one VPS is reasonable rather than a hack — a relay whose
   members are idle costs almost nothing, so the second one is not
   competing for anything until somebody uses it.

   **It also deletes a verb.** See decided item 10.

0b. **Every box rations every post it is asked to carry — partners
    included — and rationing lives where the members are.**

    > **Andy:** *"A doesn't need a per-member budget to talk to B. The
    > Governor governs that part to satisfy the prime objective: get the
    > job done. The rationing on the N1 and N2 side happens so that
    > A ↔ B can function as reliably as possible for the things demanded
    > by N1 and N2."*
    >
    > **Andy:** *"For A and B the rationing must happen for POSTs, even
    > posts from partners — that's throttling demand from any side to
    > accomplish the prime objective. The other partner will do the
    > same."*

    ```
    N1 ──post──▶ A        A rations N1, every member, and every partner
    A  ──post──▶ B        B rations A — same bucket, same rule, no branch
    B  ──post──▶ N2       N2's front door decides
    ```

    **A rations A's members; B rations B's members; A↔B is a link the
    Governor keeps healthy**, not a place where per-member fairness is
    adjudicated. Symmetric, and there is exactly one rule to get wrong.

    **THE PRIME OBJECTIVE INVERTS THE USUAL READING OF A RATE LIMIT.** The
    Governor exists to get the job done; rationing serves reliability
    rather than being a goal of its own. A limit that made the link less
    able to carry what N1 and N2 actually want would be failing at the
    thing it is for.

    ### What this retires

    - **Per-member metering across a partnership — dropped.** B never needs
      to know which member of A originated a packet, because A limited them
      before forwarding. The disclosure this would have cost (*"member M of
      A wants to know about sonny"* rather than *"A does"*) is not paid,
      and the question does not need asking.
    - **And an objection this author raised is withdrawn.** It said B being
      able to throttle only A *wholesale* was collective punishment — one
      bad member of A degrading everyone at A, a reach reduction by the
      back door. That assumed A was not rationing. With rationing at both
      ends, a flood arriving at B means **A failed to ration**, so
      throttling A is correct rather than blunt: the fault is A's, not A's
      members'.
    - **The cheap cert loses its last job.** Its remaining purpose was
      per-member accountability at B; with B metering A as a sender, there
      is nothing left for it to enable. See the note in PARTNERS.md — and
      item 0c, where Grok's one attempt to give it a job back is answered
      by two budgets rather than by a signature.

    *Already true in the branch:* `who` is `deviceIdentity(fromToken) ||
    partnerIdentity(fromToken)` and the gate keys on `who.id`, so a
    partner's posts land in the same bucket by the same rule with no
    branch — which is decided item 0c (one bus) enforced rather than
    documented.

0c. **Two budgets: members, and partners — and the members fund both.**

    > **Andy:** *"I decide that everybody rations POSTs — that's also a
    > clear autonomy boundary for partners. I, the Governor, anticipate
    > that the budget for posts from partners must be a different POST
    > budget from members. Why? Because even incoming posts from partners
    > satisfy a need from my members. In fact, I need to tax the members to
    > keep my partners operational."*

    **A forward arriving from A is not foreign demand.** It is one of B's
    own members' demand seen from the other side: N2 is being reached
    because N2 wants to be reachable. So B serving A *is* B serving its
    member, and the partner budget is **infrastructure for member reach**
    rather than a grudging allowance to a stranger. Hence the tax —
    members fund the partnerships that give them reach.

    ### It resolves the one conflict with Grok's review

    > **Grok:** *"Meter forwards per originating member key. Do not name
    > the asking member on search."*

    He wanted precision: if A fails to ration, throttling A wholesale makes
    A's well-behaved members pay. The only way he could get it was a rate
    bucket per originating member — a `partners × active members` term in
    RAM keyed by other people's identities, which is the shape
    [0012](../decisions/0012-a-relay-never-asks-for-a-member-list.md) had
    just deleted and which the meter is kept aggregate to avoid.

    **Two budgets give the isolation without the identification:**

    | | one shared budget | two budgets |
    |---|---|---|
    | A floods B | member traffic starves | **only partner-sourced traffic degrades** |
    | must B know who at A sent it? | yes, to be precise | **no** — the pool is the isolation |
    | state B holds about A's members | a bucket each | **none** |

    A misbehaving partner can exhaust the pool that exists to serve reach
    and cannot touch the pool that serves members directly. **So B never
    reasons about A's members at all** — not for rationing, not for
    metering, not for anything. The autonomy boundary is complete: no relay
    depends on another's good behaviour for its own survival.

    **A note on the parenthetical:** Grok wrote *"already on the cert"*. It
    is not — it is already on the **inner packet**, which carries
    `from = N1` by construction under tunnelling. So per-member metering
    was available with or without the cert, and this removes the last
    reason to build one.

    ### And it bounds the spam case

    A forward for an **unacquired** sender spends B's partner budget on
    something N2's front door will hold — junk, taxed to the members.
    Capped separately, junk can exhaust that pool and nothing else.

    ### Open: how the partner budget is derived

    It cannot be a constant (item 1), and by item 0 it must follow demand —
    so presumably something like **observed reach-need**: how much of this
    relay's own members' traffic actually crosses a partnership, which the
    same meter can see. An idle membership would then fund almost nothing,
    and a membership that lives on partner reach would fund a lot. Nothing
    decides the shape of that function yet.

1. **A rate limit is not a constant.**

   > *"fixing a limit as a constant seems… not very modern."*

2. **It is a division of capacity by the load on it.**

   > *"rate limits should be relay-capacity / live-nodes-at-the-time."*

3. **Capacity means RAM and bandwidth**, and nothing else is primary.

4. **The current value is streamed.**

   > *"the current rate-limit is streamed to partners and members at
   > reasonable intervals."*

5. **Bandwidth is observed, not declared** — up and down, in a ring of
   recent measurements.

   > *"bandwidth upstream and downstream could be measured and observed in
   > a ring-bucket of current measurements."*

6. **The interval is 30 seconds, and it LENGTHENS under load.**

   > **Grok:** *"30s stream interval."*
   >
   > **Andy:** *"interval may increase with increasing load."*

   The second half inverts the obvious instinct, and is right for a reason
   worth writing down: announcing costs bandwidth multiplied by members, and
   under load that is precisely what cannot be spared. A busy relay
   spending more of itself to say it is busy is self-defeating.

   **It is safe only because the refusal carries the number.** The two
   mechanisms have opposite load profiles, which is why they pair:

   | | cheap when | reaches you |
   |---|---|---|
   | the stream | idle — and nobody is urgent when idle | before you need it |
   | the 429 | busy — it happens only on a real refusal | exactly when you need it |

   So a lengthening interval does not delay the truth; it delays a courtesy
   that matters least at the moment it is withheld.

   **The risk, and it needs a ceiling.** If the interval grows without
   bound, a member's cached value becomes arbitrarily stale and every send
   turns into refuse-then-retry — which costs the relay more than the
   announcement it saved. *Open:* the maximum interval, and whether growth
   is tied to the same meters as the cap.

7. **Shedding degrades performance, never reach. Andy overrules Grok.**

   > **Grok:** *"shed forwards → partnerships → claims."*
   >
   > **Andy:** *"my relay's members are going to be most unhappy if their
   > reach disappears (the relay's function fails). Reduction in
   > performance before reduction in reach, so dropping partners early (or
   > at all)—"*
   >
   > **Andy, ruling:** *"on shedding: i win. grok loses. that's my
   > decision."*

   Partnerships are **reach**, and a ladder that sheds them second trades
   the thing members would notice for the thing they would not. It also
   contradicts a line already decided in PARTNERS.md:

   > *"So **memory pressure degrades performance, not connectivity.** A
   > relay that sheds every hint list it holds still routes everywhere it
   > did; it is just slower and chattier while it does."*

   That file already separates **dropping the hint list** (performance,
   automatic, safe) from **cancelling the partnership** (reach, owner
   input only) — three states: healthy, under pressure, cancelled. Grok's
   ladder collapsed the two.

   **The order, decided:**

   1. every performance degradation first — hint lists shed, outstanding
      routes per connection reduced toward the floor of 1, rings shrunk,
      sample intervals lengthened, announcement interval lengthened;
   2. then refuse **new** claims, which costs reach to people who do not
      have it yet rather than to members who do;
   3. **never** cancel a partnership automatically. Owner input only, or a
      partner long rank-zero and listless enough that the flag is a
      fiction — which is the existing rule and stays.

   This is decision 0007 read plainly: a relay earns its keep by keeping
   reach, and one that quietly narrows the world is failing at the only
   thing its members would notice.

8. **The RAM budget is DECLARED, not measured — and a declaration may
   only narrow.**

   > **Andy:** *"artificial bounding of available RAM: cheap-skate
   > hackists like me may want to run two relays on a VPS, so available
   > RAM can be capped is a smart design decision. (helps with testing as
   > well)"*

   **Reading `os.totalmem()` is wrong on any shared host**, which is most
   hosts. Two relays on one VPS each conclude they own the machine, each
   size themselves for all of it, and then fight. Nothing in the numbers
   tells either one that the other exists. So the operator's intent is the
   only correct source, and a declared budget is the **normal path** rather
   than a testing affordance — measurement is what fills in when nothing
   was declared.

   This is also what makes the governor's shape in recommendation 10 right
   for production and not only for a suite: `budget` is handed in,
   `observed` is read. Same seam, both uses.

   **A declaration may only narrow.** Clamp it to what the box can actually
   see — `min(declared, visible)` — so an operator who writes 8 GB on a
   512 MB box gets 512 MB rather than an OOM. A budget that can only be
   more conservative than reality is one nobody can hurt themselves with,
   and it costs one line.

   *Open:* where the declaration lives. `--port` and `--relay` are CLI
   flags, which is the precedent; a file would be the other option and
   carries the *"a floor in a file is a floor somebody can lower"* smell,
   though a budget is legitimately operator policy in a way a jail is not.

   > **Corrects a trap this author wrote in recommendation 10:** *"a
   > declared budget must never be readable as a real one, or the node
   > floor becomes lowerable by a setting."* That was confused. The floor
   > lives in `peerPost.js`, **on a node**; a relay's declared budget is on
   > a relay. Different processes on different machines — one cannot reach
   > the other, and there was never a conflict to guard against.

9. **What survives a restart is the LEVERS, not the statistics.**

   > **Andy:** *"which general stats about the extended population (# of
   > nodes in visible mesh) should be kept to facilitate smarter
   > re-starts?"*
   >
   > **Andy, answering it better:** *"if I was the Governor I would want to
   > save the state of the tuning levers, as learned."*

   The second sentence retires most of the first, and this author's answer
   to it — a bundle of peaks, cardinalities and `watchedSince` — was
   over-built.

   **Persist the governor's output, not its input.** The levers are a
   handful of numbers: `perRequester`, the byte cap, ring size, sample
   interval, announce interval. They are **decisions, not observations**,
   which is what makes them both sufficient and clean:

   - **Sufficient** — a restart resumes at the tuned position instead of
     re-deriving it. `bash/update` restarts on every tag, so without this a
     relay re-learns its own link from zero repeatedly and stays
     conservative for ever.
   - **Clean** — `perRequester = 24` says nothing about who talked to whom.
     A stored peak is a record of activity; a stored lever is a record of a
     choice. The least revealing thing to keep is also the most useful one,
     which is usually the sign it is right.
   - **Self-describing** — whatever meters exist now or later, the levers
     are the interface. A new meter does not add a new thing to persist.

   **It also dissolves a question rather than answering it.** Whether
   keeping a partner's member *count* is about the relationship or about
   their business never has to be settled: with levers saved, nothing needs
   the count, because the lever already encodes the sizing it would have
   driven. This extends *"count the relationship, never the members"* — to
   **count neither; keep what you decided.**

   Two guards, and they are the same shape as the rule for declared RAM:

   - **An opening bid, not an entitlement.** Andy: *"uplink capacity varies
     with node-locations and conditions."* A relay that moved to a worse
     link, or now shares its VPS, must not resume yesterday's aggressive
     setting. Levers load, and the ring either re-confirms them or the
     governor lowers them on the first evidence.
   - **Loaded levers may only narrow**, clamped against the boot-time
     knowables — declared budget, member count — so a file edited to say
     "allow ten times more" is ignored. **Persisted state and operator
     config may both only ever narrow.**

   *Still worth keeping separately:* `watchedSince`, but for dud detection
   rather than for capacity — a different feature with its own reasons
   (PARTNERS.md).

10. **There is no "give me your member list", and there never was a caller.**

    > **Andy:** *"the get-complete-member-list could be dropped
    > altogether — that's the slimmest initial load guaranteed at startup,
    > with no instant explosive growth."*
    >
    > **Grok had said:** *"refuse member roll."* Deleting is better than
    > refusing: a refused verb is one somebody writes a bounded version of
    > in six months.

    **Under the corrected frame nobody needs it.** The roll existed to let
    A resolve a key to a partner — the hint list, `members × ~460 B` per
    partner. But once A only ever says *"B, forward this to your member
    K"*, **A never has to know B has K.** B knows. And *which* partner
    comes from the node, which already has it: a search row carries the
    partner's URL, and PARTNERS.md's *"one route is the floor, the list is
    the point"* has the node persisting and supplying routing options. That
    job moved off the relay and the hint list did not notice.

    What it buys:

    - **The roster rule becomes structural rather than enforced.** *"A
      relay never persists a partner's members"* stops being a policy
      somebody could soften and becomes a fact: no verb could deliver
      them. The same shift the cert makes for one-hop.
    - **No `partners × members` term exists anywhere**, so it cannot be
      reintroduced by a later optimisation.
    - Startup memory is bounded by a relay's own members, permanently —
      which is decided item 0 applied to boot.

    What it costs, and it is real but small: a **cold post with no route**
    becomes a hunt — asking each partner *"do you hold K?"* — rather than
    a local lookup. N small questions on the same bus, not a bulk
    transfer. PARTNERS.md already accepts that state: *"memory pressure
    degrades performance, not connectivity"* describes a relay running
    permanently in flag-only mode. Dropping the roll means **always**
    operating in the state the design already calls safe.

    **So the per-verb list is two entries, not three:** `search`, bounded
    as it is today; and `forward`, admitted only with the cert attached and
    the inner packet intact.

11. **Rate management bootstraps on delivery that already exists.**

   > **Andy:** *"we already have packet delivery, that should be the
   > bootstrap for rate-management, there we get first measurements."*

   This is a sequencing decision and it changes the build order. Partner
   forwarding is not a prerequisite: **`routePost` between two members of
   one relay is live traffic on two real boxes today**, and it is both the
   place the first gate goes and the place the first measurements come
   from.

   Grok, independently: *"put a dumb rateOk on routePost before partner
   delivery."* Andy's version is the same instruction with the reason
   attached — the meter matters more than the gate, because a governor
   built against hypothetical partner traffic would be tuned against a
   guess.

   What follows:

   - the ring is fed by **real traffic on spirit and lab**, now, before any
     forwarding exists;
   - *"a fresh relay starts conservative and earns its ceiling"* stops
     being a claim and becomes something observable on a box in use;
   - by the time forwarding lands, the ceiling has been **discovered**
     rather than guessed, which is the whole argument of recommendation 2;
   - and the first gate is a plain static limit, not the governor. The
     governor replaces it once the ring has something in it.

---

## Recommended (Claude), not decided

### 1. ~~Two units are two limits, not one number~~ — OVERRULED

> **Grok:** *"one governor, two meters."*
>
> **Andy, deciding:** *"i agree with grok: one governor, multiple meters."*
>
> **Multiple, not two** — and that is a generalisation rather than a
> rewording. RAM and bandwidth are the two that are *primary*; nothing says
> they are the only things a relay can observe about itself. Routes in
> flight, open sockets, write latency and CPU are all meters, and some of
> them are already reported. So **the governor takes an open bag of
> readings, never a fixed pair** — see recommendation 10, whose signature
> is written that way for exactly this reason: a new meter should be a new
> key, not a new argument and not a second governor.
>
> **Andy:** *"if bandwidth gets critical before RAM, the relay can increase
> the number of duplicate routes allowed, later shedding, more precise
> measurement rings. With low RAM, high bandwidth: reduce the number of
> allowed routes for a connection all the way down to 1 (floor), reduce
> measurement rings to a smaller size with larger sample intervals."*

**The two resources trade against each other, and that is what settles it.**
Spare RAM *buys* bandwidth — more outstanding routes per connection means
fewer retries means fewer bytes. Scarce RAM *spends* bandwidth instead —
one route per connection, serialised, retried. Two independent limiters
cannot make that trade; each can only defend its own resource while the
other sits idle. **One governor reading two meters can**, which is Grok's
shape — and Andy's sentence is the argument for it rather than a
refinement of the recommendation it replaces.

The self-referential part is worth keeping: **the ring is itself RAM**, so
under memory pressure the governor shrinks its own instrumentation —
smaller rings, longer sample intervals. *Open, and a real tension:* that
degrades measurement quality exactly when the decisions are hardest, so the
ring needs a floor for the same reason sends do.

What stood before the overrule is kept below, so the reasoning that lost is
still legible:

RAM and bandwidth bound different things and cannot be collapsed:

| | is a | spent by | bounded figure |
|---|---|---|---|
| **RAM** | stock | what is *outstanding* — routes in flight, held sinks, rate buckets | concurrent routes per member |
| **bandwidth** | flow | bytes moved | bytes/min per member |

Ten thousand posts a minute that all complete cost almost no RAM. A hundred
that hang cost more. A single sends/min figure governs neither well, which
is why `routes` — already reported — is the RAM-side number and a byte
count is the bandwidth-side one.

### 2. Throughput is not capacity: the ring needs a saturation signal

A ring of byte counts records what the box *did*, not what it *could*. Low
numbers are ambiguous between "plenty of headroom" and "tiny pipe, nobody
tried", and no amount of counting bytes separates them.

So each slot should carry a symptom beside the count — write latency, or
send-queue depth:

```
throughput rising,  latency flat      →  headroom; raise the published number
throughput plateaus, latency climbing →  the ceiling, found without configuring it
```

That is the honest definition of capacity: **the highest throughput observed
while the box still felt fine.** Discovered, never declared — which is what
makes it "modern" in the sense Andy meant, rather than a constant with a
formula wrapped round it.

### 3. The discovered peak decays

A relay that managed 50 Mbit at 03:00 on an idle link must not assume it at
21:00 on a contended one. Use a **windowed max** — best in the last N
buckets, not best ever — which the ring already gives for free.

A property worth liking falls out: a fresh relay **starts conservative and
earns its ceiling** by watching itself succeed. Safe by default, nothing
configured, improves with evidence.

### 4. Aggregate only. Never per-peer.

The ring is one structure for the box, two directions. The same ring kept
*per member* would be a record of who talks how much and when — precisely
what this system refuses to hold — and it would arrive **by the side door**,
as a performance feature, in a file nobody thinks of as a ledger.

The precedent is already written, for the route-usage counter:

> *"in memory is the whole point: it resets on restart, it is never served,
> and it describes the relay's own work rather than anybody's traffic. A
> counter that survived a reboot would be a record of who talks to whom,
> which is precisely what this system does not keep."*

One ring, two directions, each slot `{bytes, elapsed, latency}`. Enough to
govern; not enough to reconstruct anybody's behaviour.

### 5. A floor, expressed as work rather than as a number

Pure division has a failure mode: under load everyone converges on nearly
zero, including the packet that would say *"I am being starved."* A
guarantee is what makes the dynamic part safe to be **aggressive** — if
nobody can be starved, the shared portion may swing hard.

But it should not be written as a constant. Write it as a requirement in
units of work:

> **One greeting and a handful of replies per minute must always get
> through.**

Then it is derived from the smallest useful thing a person can do, and it
has an honest failure mode: a relay too loaded to honour it should **stop
accepting new members and say so**, rather than silently starving the ones
it has.

The streamed number is then the **burst above the guarantee**, and it is
free to move because nothing depends on it holding still.

### 6. The published value is in force until superseded

This is what removes flapping, and it needs no damping function. If the
number a relay streams is the number it has **committed to for that
interval**, the value cannot move between announcements. Hysteresis stops
being a tuning constant and becomes a property of the protocol.

### 7. The refusal names it — and there is a precedent

> *"It is NAMED in the refusal — the one thing this route ever says
> precisely — because it is temporary and a page that knows it is
> rate-limited waits rather than gives up. Everything else gets `not now`."*
> — [relay.js:83](../../spirit/run/js/relay.js#L83)

So a member holding a stale value self-corrects on refusal, and the stream
is the fast path rather than the only path. **Nothing has to be reliable.**

### 8. The real payoff is partner-side backpressure

A partner that knows B's current budget can slow down or refuse **locally**
instead of forwarding into a wall and learning by 429. That converts abuse
control from *"refuse at the destination"* into *"do not send"* — which is
what keeps `partners × members` from being a flood, and it is not available
at all without the streamed value.

### 9. `limits.js` is not a rate limit and should stop being filed as one

`PAYLOAD_MAX` is a **format** constant: both ends must agree statically or
the client's pre-check breaks (*"a cap the client pre-checks must be the
cap"*). It is grouped with rate limits because it lives in the same
sentence, which is a naming accident rather than a decision.

### 10. It is `peerSearch` again: a module, with its observations injected

> **Andy:** *"for testing purposes, we can reduce the ram-size and fake
> other constraints on local test relays to test the adaptable rate and
> limit management."*

That requirement decides the shape, and it should be taken further than it
sounds: **fake the observation, not the resource.**

Really constraining a box tests V8's OOM behaviour. Injecting *"rss is at
90% of your budget"* tests the governor. Only the second belongs in a suite
— so the governor must never call `process.memoryUsage()`, `Date.now()` or
a socket itself. It is handed what it is allowed to know:

```
govern({
  budget:   { ... },      // what this relay believes it has, per meter
  observed: { ... },      // AN OPEN BAG OF METERS — rss, routes, ring,
                          // latency, sockets — never a fixed pair. Andy:
                          // "one governor, multiple meters."
  now,                    // injected clock
})  ->  { perMemberBytes, perMemberRoutes, floorHeld, why }
```

The precedent is exact, and it is Andy's:

> *"i want the graded search logic and that stuff isolated from relay or
> other core components, since quality-of-result measurements etc. are up
> in the air and we need to have this block separately tested and verified,
> and give it an independent evolution path."*

Every word of that is true of a rate governor, and for the same reason: what
a good limit is will be wrong on the first try, and `relay.js` should hold
no opinion about it. `relayStatus.report` already takes `proc` and `now` as
options rather than reading them, so the pattern is in the neighbourhood
already.

**Why this matters more here than it did for search.** An adaptive limit has
*history* — a ring, a decaying peak, a value committed until the next
announcement. Against a live box those are untestable in practice: you
cannot make a relay run out of RAM on demand, you cannot hold a link at 80%
for ninety seconds, and every run differs. Against an injected clock and a
handed-in ring they are ordinary assertions, and the edges become reachable:

| assertion | what it catches |
|---|---|
| the floor holds as capacity → 0 | the starvation failure mode, including the packet that would report it |
| plateau + rising latency lowers the published number | the ceiling is *discovered*, not merely tracked |
| a quiet hour does not raise the ceiling | throughput mistaken for capacity |
| the peak decays out of the window | yesterday's 03:00 figure applied at 21:00 |
| a fresh relay starts conservative | no configuration, safe by default |
| the value does **not** move between announcements | committed-until-superseded, which is the whole anti-flap property |
| the refusal names the number | a page that waits instead of giving up |

Every one of those is a pure function of injected inputs. None needs a
socket, and none is flaky.

**And the lab still has a job.** The in-process suite proves the policy; a
lab relay handed a small *declared* budget proves the wiring — that the
number reaches a member's stream and a partner's, that a client pre-checks
against it, that a refusal carries it. `labMaster` already builds relays
with their own homes, so "start this one believing it has 32 MB" is a field
in the node record rather than a new mechanism.

Two traps worth naming before anybody builds it:

- **A governor that reads the world cannot be tested, and will therefore be
  tested in its comfortable region only.** That is the failure this
  recommendation exists to prevent: adaptive systems are easy to demonstrate
  working and hard to demonstrate failing safely.
- ~~**A declared budget must never be readable as a real one.**~~
  **Withdrawn — see decided item 8.** A declared budget IS the production
  path, because measuring total RAM is wrong on a shared host. And the
  conflict this feared does not exist: the floor lives in `peerPost.js` on
  a **node**, and a relay's budget is on a **relay**. What replaces it is
  a smaller rule: a declaration may only ever narrow, never widen.

---

## The carve-out: the node's floor stays a constant

A constant is right exactly when its purpose is **to be unnegotiable**, and
those two numbers are a jail rather than a fair share:

> *"It lives here rather than in a file because a floor in a file is a floor
> somebody can lower. AGENT.md: the server is the only jail."*

The floor also draws the distinction this whole document depends on:

> *"the PREFERENCE decides who you talk to — the FLOOR decides what a
> stranger can spend."*

Widening reach touches the first. It must never touch the second. **If the
floor became a function of anything, the one number that does not move when
reach widens would start moving** — and the argument at the top of this
document, that the conduit decision costs nothing here, would stop being
true.

---

## Open

- ~~**What is the interval?**~~ **Answered:** 30 seconds, lengthening under
  load — decided item 6. What remains open is its **maximum**: an interval
  that grows without bound turns every send into refuse-then-retry, which
  costs more than the announcement it saved.
- **Partner streams carry "request and reply, and nothing else"**
  ([partnerLink.js:106](../../spirit/run/js/partnerLink.js#L106)),
  deliberately. A limits event widens that. Defensible — it is the relay's
  own state, not anything about its members, so the roster rule is untouched
  — but it should be a written decision rather than a side effect.
- **Which number wins** when the streamed value and a client's cached one
  disagree, and what a member who has never streamed assumes before its
  first announcement. The refusal makes this survivable, not correct.
- **Does the ceiling apply to the owner?** An owner posting to its own relay
  is not a stranger and not really traffic; whether it is governed at all is
  undecided.
- **What does a relay do when RAM is the binding constraint rather than
  bandwidth?** Shedding hint lists is already designed (PARTNERS.md, *"the
  algorithm, and it is a division"*). Whether rate and shedding are one
  governor or two is not.
- **Nothing measures any of this yet.** The figures above are the ones the
  relay already reports; no suite drives them under load, and `liveRelay.js`
  is the only thing in the tree that touches a real box.

---

## What it would touch

- `relay.js` — the ring, the governor, the `routePost` gate that does not
  exist yet, and the stream event.
- `relayStatus.js` — the published figure, beside `routes` and `memory`.
- `partnerLink.js` — accepting the event on a partner stream.
- `presenceNode.js` — accepting it on a member stream.
- `limits.js` — nothing, and that is the point of recommendation 9.

**This is `relay.js` gate and persist-shape work, which CLAUDE.md names as
a stop-and-call-a-team-review line.** Nothing here should be built from this
document alone.
