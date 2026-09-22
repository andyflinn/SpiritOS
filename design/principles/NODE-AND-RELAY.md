# A node and a relay are two different things

**Co-design, 2026-09-18. Verified against `e537880`. Nothing built.**
**Amended 2026-09-19, tree claims re-checked at `c3cd6d0`:** the three levels of constraint, and every persisted
dataset bounded by disc space or an allotment (§8); every lever declares
its floor and ceiling with reasons (§10); the owner's only real-time tool
is a signed grant (injecting a partner, minting an invite), and the
Governor is programming alone; both owners sign a partnership, the relay
verifies and may reject, revocation is silent, and every relationship is a
row in one partner roll; a partner interface for self-management (§5).
Routes are the node's, stored on contacts as relay IDs; the relay keeps no
route cache (§9b). The owner does not duplicate member storage (§2).

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
| **remembers** | **accumulates** — the log is permanent, *"memory is the training set"* (0009) | **forgets** — every store is a recency window against a configured ceiling (§8, *the databases are rolling windows*) |
| **member storage** | **none** — not even the owner's node holds a copy of its relay's member roll or partner roll | the only copy. **DISC:** the full roll, flushed automatically longest-inactive first. **RAM:** only the currently active members |

> **Andy (2026-09-19):** the owner will not duplicate member storage. The
> owner's node receives the relay's report — counts, levers, decisions —
> and never a member list, which 0012 (widened 2026-09-18) already refuses
> to serve to anyone, the owner included.

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

> **Amended 2026-09-21 — what "human readable" covers, and what it does
> not.** Decided as
> [0018](../decisions/0018-the-route-cache-belongs-to-the-machine.md):
> *"the route cache belongs to the machine, not the human."*
>
> > **Andy:** *"since it could grow as large as the relay's member roll,
> > it may have to optimize access, and since it's NOT directly for the
> > user, it is exempt from human readability."*
>
> > **Andy:** *"the routing cache is information that belongs to the
> > network, it isn't information that the user acquires or cares about:
> > The executable server.js is conceptually not readable by a human."*
>
> **The line is WHOSE INFORMATION IT IS**, not what shape it happens to
> take. The premise reads a node's readability as covering everything on
> its disk; it covers what the sentence names — **the digitisation of its
> owner's spirit**. Contacts, writing, the record of what crossed the
> wire: things the owner ACQUIRED, and can open and recognise their own
> life in.
>
> A routing cache is none of that. It belongs to the network: it exists
> because relays and nodes spoke to each other, and the owner neither
> acquired it nor has any reason to care what is in it.
>
> **And the rule has always had this exemption without naming it.**
> `server.js` sits on the node's disk and is text, and nobody has ever
> argued that readability obliges it to be prose. It is the machine's,
> not the person's. `seenPeers` is the same kind of thing — a shadow of
> this node's own traffic, keyed by peer, which can reach a relay's roll
> in size and which no person will ever open.
>
> So the question to ask of anything on a node's disk is not "can a human
> read this" but **"did the owner acquire it, and would they care?"**
>
> **The dependency clause survives intact**, and that is worth checking
> rather than assuming: `node:sqlite` is built into node, so "no
> dependencies outside native node.js" still holds.
>
> **What it costs is the floor.** `package.json` says `node >=18`;
> `relayServer.js` refuses to start below **22.13**, which is where
> `node:sqlite` arrived. An indexed store on the NODE moves every user's
> minimum to 22.13 — a real price for something people install on their
> own machine, and the one thing this amendment does not decide.

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
unaccountable. *Disagreeing means changing the programming, offline — never
moving the lever (§5, scope).*

### Active members, not enrolled

`present` is `Object.keys(sinks)`
([presence.js:143-145](../../spirit/run/js/presence.js#L143-L145)) — free,
and bounded by the connection cap. *This corrects the line as first
written: there was no connection cap — nothing bounded the total number of
held streams until cycle 1 built the connection allowance (2026-09-19).* `peers` is `who()` over the whole roll,
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

### The Relay Monitor (cycle 4 planning, 2026-09-19)

**Decided (Andy):**
- **Home: an intrinsic app, the Relay Monitor**, not natterDetails (the
  provisional home). Why a separate app: natterDetails' monitor rows can fall
  into deprecation (D9), and a dedicated app has room for dialogs.
- **A dropdown: `All` (default), then each owned relay.** `All` is
  **triage** — it helps the owner pick which relay to examine: a list, most
  in need first, each row with its reason, each opening its relay.
- **The order is learned, so it is not in the screen**: a replaceable
  ranking module on the node (like gradedSearch beside relay.js) returns
  `{relay, score 0..1, reason}`; cycle 4 ships the simplest rule (lowest
  lever headroom, heap % of limit); tune-develop cycles replace the module.
  *Future:* the dropdown ordered the same way, red in the font fading with
  the score.
- **The relay reports; it never selects.** It sends *all its status* every
  tick — every fact about the box, in a fixed shape (each lever, heap,
  activity, routes in flight, counts by state) — and has no authority to
  decide on the owner's behalf. *(Supersedes two notes of the same
  conversation that had the relay ranking, then picking "its worst few".)*
- **The relay's decision-making is exactly its Governor's scope** — its own
  resources, inside its programming and the configuration; every such
  decision is itself status, with its reason. Everything else is the
  node's: grading, ranking across relays, what is critical.
- **The relay is a sensor, the node the recorder.** Gauges (a lever's value,
  connections, routes, heap: the reading is the amplitude) and counters
  (moves, closes, refusals — only up since start: the node's rate is the
  difference of two samples). The relay keeps no window; every report
  carries its capture time; a counter that falls means a restart; gaps stay
  gaps. *(Illustrations, not commitments: a crude audio analyser on the
  node; time-compressed replays. Open option: a gauge's peak since the last
  report.)*
- **Cadence, provisionally:** while the monitor is open, the relays it shows
  push their report every Governor tick; closing it stops them. The node
  counts open views (desk and phone) and switches off at the last.
- **Observe traffic live: a dialog** with a relay selector mirroring the
  app's (including `All`, merged by time), the existing `monitor` filters
  applied at the relay — one member's traffic across every owned relay is
  the same `peer` filter sent to each. Live and forgotten: memory only.
- **Devices:** a phone watches what its node can watch; levers move through
  the node. *Vision:* the owner's phone streaming status straight from the
  relay under a node-signed, watch-only grant for the phone's session,
  revoked by a password rotation through a signed **epoch** the relay keeps
  as one number — still no device key on the relay (2026-09-13 stands). A
  protocol decision (0010) when it comes.
- *Vision:* a per-lever dialog — one lever across all owned relays, against
  its effects; needs trends kept on the node.

**AMENDED 2026-09-22, after cycles 8 and 9.** Andy, on reading the section
above: *"the monitor was already designed, it is stale now."* Four things
moved under it, and the UI session must read these rather than the list
above where they disagree.

- **There is no tick.** The Governor was deleted in cycle 8 (*"relay will
  self-manage within fixed/constant limits"*), and with it the five-second
  timer the cadence above assumes. A relay now reports **on every event**,
  in full, with no coalescing — Andy: *"if the relay can handle 500
  near-simultaneous connects, AND broadcast them … the owner certainly can
  handle the incoming updates."* So *"every Governor tick"* reads as *"on
  every event, and when the monitor opens"*.
- **Levers no longer move, so ranking cannot be about their headroom.**
  The allowance is fixed at boot from the owner's RAM (`relay.js`,
  `allowanceFor`) and reported as a read-only gauge. The triage rule
  sketched above — *"lowest lever headroom, heap % of limit"* — needs its
  first term replaced: **connections against the allowance**, and now also
  **the roll against the disc figure**.
- **There are two bounds, and the report says which one is biting**
  (cycle 9). `ramLimitMB` bounds who may be connected; `discLimitMB`
  bounds how many there may be. `relayStatus.report` carries both, plus
  `discUsedMB` and `binding` — so a screen that draws only memory is
  drawing half the box. The 70% warning belongs against whichever is
  biting, not against the allowance alone.
- **"The relay is a sensor, the node the recorder" is now a store, not a
  metaphor.** Decision 0015 left *"what 'record' means concretely"* open;
  Andy settled it on 2026-09-22 — the history is kept **on the node**, in
  `node.db` (*"this is not user-stuff, its machine and network
  maintenance"*), owner-only, with stream open/close rows so gaps are
  recorded rather than guessed. The monitor draws the member curve from
  that, and the relay still stores no history.

**And one thing the monitor may now do that this section forbids.** The
owner configures a relay's figures over the wire (cycle 9, R7): a signed
`{ config: … }` posted to the relay's own key, read and set, with an
optional restart. That is deliberately **core-only** — Andy: *"remote
adjustment with possibly restart must be there, at least in the core, not
neccessarily in UI"* — so the Relay Monitor may grow a control for it
later or never. It is not a lever, and it does not reopen §5: the
configuration is still read once, at boot.

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

### Scope: the owner's only real-time tool is the partner list

> **Andy (2026-09-19):** *"This design does not include or consider the
> owner's node moving levers remotely and/or interactively. The governor
> will be a result of programming."* — *"The only real-time tool the owner
> gets while node and relay are running: injecting foreign partners."*

*Refined the same day: the real-time tools are **signed grants of
admission** — injecting a partner, and minting an invite, which is the same
kind of act (see above).*

| while running | not while running |
|---|---|
| inject (and revoke) foreign partner URLs; mint invites | lever positions — the Governor's, from programming |
| observe the report (§3, §4) | the configuration file — the box's bounds (§8) |
| | the programming itself |

So the Governor has **one input, its programming**, and the owner's node is
an observer of it. Anything below that reads as the owner adjusting a lever,
a bound or the configuration at runtime is outside this design and marked
where it appears.

### Superseded later the same day: each lever declares whether it is live

> **Andy (2026-09-19):** *"The partner-to-partner API and the lever
> configuration API on the relay are scaffolding too, even if they change
> shape later on."* — *"What it allows us to do: proof that ceilings can be
> changed from 'dynamic' to fixed for max-connections. And it gives us the
> vehicle to decide which levers can be real-time altered or not."* —
> *"Bounded by 1) the box and 2) configured RAM limits. The scope of owner
> control on levers cannot override configuration values that protect other
> servers on the same box."* — *"Higher-order limits are read once, at
> startup, and stay fixed."*

**Decided.** *This supersedes the scope rule above in part: the owner may now
move a lever at runtime — but only a lever that declares it.* Three layers,
each bounded by the one above:

| layer | changed while running? |
|---|---|
| **the box** | never — it is the fact |
| **the configuration** — `ramLimitMB`, and any value protecting other servers on the same box | **never.** Read once at startup, fixed until restart; no owner command overrides it |
| **levers** | only a lever that **declares itself live-changeable**, and only inside the two above |

- **The lever configuration API** is an owner-signed post to the relay
  itself, like the owner verbs that already exist (`relayLabel`, `monitor`)
  — no new route. Refused for a lever not declared live.
- **Its first job is a proof:** switch max connections from `"dynamic"` to a
  fixed number while the relay runs, and watch the Governor respect it.
- **Live settings persist to `relay-state/levers.json`**, never to
  `config.json` — the file holding the protections is only ever written by a
  person with a shell.
- **Grants stay live** as before: injecting a partner, minting an invite.
- **The Governor is still programming**; a live lever setting is a bound or a
  pin inside which it works, not a second input it must arbitrate.
- **Build sequence:** the configuration API is scaffolding, cycle 4 beside
  the visual monitor — one shows a lever, the other moves it.

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

> **BROKEN BY THE 2026-09-21 PARTNER DESIGN, and it is the security half
> that breaks.** Ten members' contacts span **hundreds** of relays
> ([REQUEST-BUDGET.md](../relay/REQUEST-BUDGET.md), *"How many partners
> does it take to route ten members' contacts?"*), which no owner can
> write down or keep current. So partner URLs now arrive from **members'
> route hints**, and this rule cannot survive in that form.
>
> **What it was protecting is still real**, and `PARTNERS.md:463` named
> it while arguing the other way: *"A relay that fetches a URL is a relay
> with an SSRF surface, a timeout budget and a retry policy, on a box
> whose whole design is to do less."*
>
> **What guards it today, and where the guard stops.** `assertRelayUrl`
> (`relayRequest.js:42`) requires `https:` **except** that it allows
> `http:` to loopback, for lab relays. Against owner-written URLs that is
> ample. Against member-supplied ones it leaves two doors open:
>
> - **`http://127.0.0.1:<anything>`** — a route hint naming loopback makes
>   the relay dial **its own box**, on any port, reaching whatever else
>   that machine runs.
> - **`https://<private address>`** — the protocol check passes, so an
>   internal service on a LAN is reachable.
>
> Neither is exploitable now, because every partner URL is written by
> `setPartner`, an owner verb. **Both go live the moment a URL can come
> from a member**, so a replacement rule is a prerequisite for open
> partnering rather than a follow-up to it.
>
> **The shape a replacement has to take:** the owner's allow-list is gone,
> so the bound must be on the URL itself — public addresses only, no
> loopback and no private ranges when the URL did not come from the
> owner. That distinction (owner-written versus member-supplied) is
> already the `partnered` / `requested` split this design uses elsewhere.

Which is the containment `assertRelayUrl` already gives the node. The change
is not "relays can call out" — it is "relays can call out *to a list*".

**Precedent exists for both halves.** Owner writes a file and the relay
notices: `allow.json` plus `reloadAllow()`
([relay.js:440-442](../../spirit/run/js/relay.js#L440-L442)), for members.
Relay reaches out without `relay.js` learning how: `askPartner`, injected.

### Injection is owner-only, and the relay may reject it

> **Andy (2026-09-19):** *"The partners that can be injected by only the
> owner, the relay must verify it's an actual relay and capable for
> partnership; the relay may then reject the injected partner."*

Injection admits a **candidate**, not a partner. Three steps, in order:

| step | who | what |
|---|---|---|
| inject | the owner, and nobody else | a URL enters the candidate list |
| verify | the relay | the URL answers as **an actual relay**, and is **capable of partnership** |
| accept or reject | the relay | a candidate that fails either check is rejected |

> **Andy (2026-09-19):** *"It delegates authority to the relay to partner
> with the injected relay."*

**An injection is a signed grant, and a delegation.** The owner signs it
over the authenticated protocol, like any owner verb; what it grants is the
relay's authority to partner with that one relay — propose, consent, keep,
end — without asking again.

That makes it the same kind of act as **minting an invite**: both are the
owner signing an admission. An invite admits a person and is redeemed by
them; an injection admits a candidate relay and is exercised by the owner's
own relay. So the owner's real-time tools are one category — **signed
grants of admission** — and minting is not an exception to the scope rule
below; it is the other member of it.

So the owner bounds the set and the relay still guards it: a URL the owner
wrote down is necessary, never sufficient. This is §8's three levels applied
to partners — the owner narrows who may be considered; the relay decides
within that, including *no*.

**What "verify" can stand on today, and what it cannot.** PARTNERS.md's
handshake *"verified reciprocity against the far public census"* — and the
census is gone (2026-09-18). `GET /api/relay/key` says who a box is and who
runs it, which covers *"an actual relay"*. **Nothing on the wire says
*"capable of partnership"*** — which is the same gap as §7: a box has no way
to say what it speaks. One answer can serve both.

**Decided (Andy, 2026-09-19, accepting the recommendation):** a rejection reaches the owner with its reason,
down the owner's stream as `partner-added` / `partner-removed` already do
(`ownerEvent`, [relay.js](../../spirit/run/js/relay.js)) — otherwise the
owner's one real-time tool fails silently.

### Both owners sign, and a proposal is answered by an injection

> **Andy (2026-09-19):** *"It needs that owner's signature as well"* — and,
> on the alternative of an owner-set acceptance policy, agreed that it is
> out: *"the design must include the streaming of the partner-request to the
> node for minting by the owner. The scope of this design does not include
> node-side mechanisms for managing that request. Ideally the minting
> request can be answered with a matching minting request."*

**Decided:** a partnership needs **both owners' signed injections**. No
acceptance policy — a policy would have the relay vouch for boxes its owner
never saw, let other people's injections widen its world, and be a standing
rule (configuration) rather than a grant, reopening the scope below.

**Decided:** when a relay receives a proposal from a relay its owner has not
injected, it **streams the request to its owner's node**. What the node does
with it is outside this design.

The flow, and the answer is an ordinary injection:

```
A's owner injects B        → A verifies B, proposes to B
B: no injection for A      → B writes a `requested` row, streams it to its owner
B's owner injects A        → the matching injection is the answer
both sides hold a signature → the partnership forms
```

> **Andy (2026-09-19):** *"If a relay receives a minting request where its
> own owner already minted the request, it will not be streamed to the
> owner's node — ending the minting cycle."*

**Decided:** a proposal from a relay the owner **has already injected** is
not streamed; it is the other half of a partnership the owner already
granted, and the relay consents on that delegation. This is what closes the
loop: when B's owner answers by injecting A, B's consent reaches a relay
whose owner injected B first, so nothing is streamed at A either. **An owner
is asked at most once per partnership, and only the owner who had not yet
signed.**

**Recommended, not decided:**

- **The request carries the proposal's hash as `cause`** (0011), and the
  answering injection carries it back — so the injection is a *reply* to
  that request rather than a coincidence of URLs.
- **A rate gate on unsolicited proposals**, or any relay can flood an
  owner's stream. It is a lever, so it needs its floor and ceiling (§10) —
  **open**. The allotment below bounds what is held; the gate bounds how
  fast it arrives.

### The partner roll: one dataset, a status per row

> **Andy (2026-09-19):** *"Can the minting request just be a status field on
> the partner-roll, and get auto-flushed under the partner roll rules?"* —
> agreed, with the condition below.

*This supersedes a recommendation made earlier the same day, that B store no
pending request and let an absent owner lose it. A pending request is a row,
bounded like every other row.*

**Decided:** every partner relationship — granted, asked or formed — is a row
in one **partner roll**, with a status:

| status | meaning | created by |
|---|---|---|
| `injected` | my owner signed; waiting for the far side | my owner |
| `requested` | the far side proposed; streamed to my owner, waiting for them | a foreign relay |
| `partnered` | both owners signed | both |

The roll is a persisted dataset, so it is bounded by a disc allotment and
flushed under the roll rules (§8): a rolling window, longest-idle first. An
owner who is away no longer loses a request — the row waits, bounded.

**Decided — the condition: `requested` rows get their own allotment.** They
are the one status a stranger can create, just by proposing, so in a shared
pool a flood of proposals would flush real partners. That is §8's *partition
by life cycle; do not rank across life cycles* again: `requested` is
short-cycle and foreign-made, `partnered` is long-cycle and made by both
owners. A flood can only ever flush other `requested` rows.

This is the store PARTNERS.md specified (`partners.json`, keyed by relay
key, §6), with a status added.

### Revocation is silent

> **Andy (2026-09-19):** *"B will no longer successfully handshake with A
> (not known), mark its record. Courtesy is not in the scope of this doc."*

**Decided:** when A's owner revokes B, A's row for B goes, and **nothing is
sent to B**. B learns at its next handshake, which fails because A no longer
knows it, and B marks its own row. No notice to B's owner, no end message —
the failed handshake *is* the signal.

**Recommended:** B's mark returns the row to `injected`, because B's owner's
grant still stands; if nothing answers it, it ages out under the roll rules
like any idle row.

The same holds for every ending: a relay that stops partnering stops
answering, and the far side finds out by trying. Courtesy — telling anyone —
is outside this design.

### The first claim needs a token, from an installer

> **Andy (2026-09-19):** *"Relay currently goes keys mode on first claim. I
> think that first claim should be protected by a token as well."* —
> *"Ideally there is an install.js console program that guides the
> owner-on-ssh through defining first claim name with a sufficiently complex
> token, which can be copied from the bash window and pasted into the
> node-shell's claim interface."* — *"I don't think we want to publish lab
> on VPS."*

**Decided.** An open relay today belongs to whoever reaches it first (the
startup warning says so). Instead:

1. **An interactive `install.js`, on the VPS over SSH,** asks for the owner's
   name and mints an **owner invite** with a long random token — the same
   generator ordinary invites use — and prints name and token to copy.
2. **The token is shown only in that SSH session,** never printed by the
   relay at boot, where systemd's journal would keep it.
3. **The owner pastes name and token into the node shell's claim screen**,
   which already takes an invite name and token (`natter.js`). That claim
   becomes the owner; the relay goes keys-mode as today.
4. **An unclaimed relay refuses any claim without a valid invite.** This
   amends [0003](../decisions/0003-first-claim-is-owner.md): *first invited
   claim is owner*.
5. **VPS only.** Lab and test relays stay on the workstation and mint their
   owner invite in-process, as the harness already builds relays.

It supersedes `install-public-relay.js`'s name reservation
(`pending-owner.json`), which reserves a name with no secret behind it.
Cycle 3, with the storage move — both touch claims and invites.

**Built: cycle 3, Part B.** `install.js` at the repo root; the owner invite
is marked (`invitedBy: '(installer)'`) so that only it can make an owner;
an unclaimed relay says so at boot; a relay with members but no owner
refuses to start (exit 78, `RestartPreventExitStatus=78` in the unit), and
`bash/restart` and `bash/update` report the refusal from the journal.

~~**Open:** a relay deployed without SSH (the Procfile/Heroku path) has no way
to run the installer.~~ *Closed by removal (Andy, 2026-09-19): the
`Procfile` is deleted. That path's filesystem is ephemeral: `relay.db`,
`allow.json` and `identity.json` would be wiped on every restart, so it
could never have kept a relay's members or its owner. A relay needs a
persistent disc and SSH.*

### Relays need a partner interface, defined for self-management

> **Andy (2026-09-19):** *"Relays need a partner interface. It must be
> defined with the objective to enable relays to self-manage
> partnerships."*

The objective decides the contents: everything a relay must do to form,
keep and end a partnership **without a human in the loop**, inside the
candidate list its owner wrote. Today the partner vocabulary is two words,
`search` and `forward` (0012) — **both are traffic; neither manages the
partnership.** Formation is an owner verb on a peer row, and ending one is
the same.

What self-management needs, at minimum — **the list is recommended, the
objective is decided:**

- **describe** — what this box is and speaks (the verification above, and §7)
- **propose / consent** — partnership is mutual (PARTNERS.md), so each side
  must be able to ask and to answer
- ~~**decline / end**~~ — *not a verb: ending is silent, and the far side
  learns by a failed handshake (see "Revocation is silent" above).*
- **terms** — the current cap, which PARTNERS.md already recommends carrying
  on every reply rather than announcing

**Constraints it inherits, already decided elsewhere:**

- Signed posts between relays, on the one partner bus — *"a new thing
  partners can do is a new key in a body; never a new event, a new route,
  or a second channel"* (PARTNERS.md).
- No verb that asks for a member list (0012).
- A relay reaches only URLs its owner wrote down (above).

**This amends 0012's "two words".** The member-list ban is untouched; the
vocabulary grows by management verbs. Named here so it is decided, not
drifted into.

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

### The old model is deprecated

> **Andy (2026-09-19):** *"The old partner acquisition model is rejected,
> deprecated and will be eliminated as soon as this design is proven, or
> not."*

**Rejected:** partnership as a flag on a member's peer row, promoted by an
owner verb (`setPartner`, `partner` on `answerSelf`), with its membership
requirement. It stays in the tree only until this design is proven, and
then it goes. Do not extend it, build on it, or fix it forward in the
meantime.

### The vouch: the new model's bootstrap (cycle 5's first piece)

**Decided (Andy, 2026-09-19):** where the old promotion form sits
(natterDetails → Managing my relay → Partner relays), the owner vouches:
*"I vouch for the relay at https://lab.andyflinn.com"* — §5's injection.
- The owner's node resolves the URL to its relay key; the signed owner verb
  carries both (`{ vouch: { url, relayKey } }`); the relay records an
  `injected` row and fetches nothing (`relay.js` makes no outbound request).
- **No seats**: lab and spirit partner without either owner holding a seat
  on the other's relay. Each relay's own row is its half; traffic flows
  when both owners have vouched.
- **The dial is the confirmation**: A dials B with its relay key; B accepts
  only if B vouched for A. Accepted = mutual; refused = "waiting for them".
  No new verb. Confirmed by a spawned two-relay suite.
- **An unanswered vouch lives until disc needs the space**: waiting rows
  share the partner roll's allotment and the longest-waiting is shed first,
  silently — "we should do coffee sometime… but we never do".
- **When:** cycle 5's first piece, straight after cycle 4; **before alpha**
  at the latest, because the old form's deprecation (D10) is eliminated only
  once the vouch exists.

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

### Three levels of constraint, each bounded by the one above

> **Andy (2026-09-19):** *"The physical box has RAM and DISC constraints. A
> node's configuration (file) is bounded by the physical constraints. The
> governor is bounded by the configured constraints."*

| level | what it is | bounded by |
|---|---|---|
| **1. the box** | physical RAM and DISC — what the owner bought | nothing; it is the fact |
| **2. the configuration** | the owner's ceilings and allotments, a file | the box |
| **3. the Governor** | lever positions | the configuration |

Every number in this note sits at exactly one level. A configured ceiling
larger than the box is a misconfiguration, not a generous setting; a
Governor position outside the configured bounds is a defect, not an
optimisation. Each level may narrow the one above it and never widen it.

> **Any persisted dataset is bounded by actual disc space or by a configured
> disc allotment.** Those are the true constraints. Expiry, lifetime and
> inactivity rules are *policy inside* that bound — they bound age, and age
> is not space.

**Configuration by verb, not by file — superseded 2026-09-19.** *The
configuration is a file (the hierarchy above) and is not changed while the
relay runs (§5, scope). Kept as the record of what was proposed.* *Revived in
part later the same day: the configuration stays file-only and fixed, but
levers that declare themselves live may be moved by an owner verb, persisted
to `levers.json` (§5, "each lever declares whether it is live").* A relay
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
| **3. cache history** | partner rows warmed by route hints, label cache | ~~verified routes, by `lastVerified`~~ — **withdrawn 2026-09-19**: routes are the node's (§9b) |

*With the route cache withdrawn, the relay's growing disc datasets are the
member roll, the partner roll (§5) and the invites — each with its own
allotment. Where this section argues from the disc route cache below, that
argument is superseded; it is kept as the record.*

Parts 2 and 3 are rolling windows bounded by their allotment, in both. Part
1 is not a window and has no lever: it is simply there, bounded by actual
disc space like everything else persisted.

**Invites need an allotment as well as a lifetime.**

> **Andy:** *"A standing invite will expire when it's the oldest invite
> bumping against the DISC limit for invites."*

Two earlier drafts filed invites as *self-bounding*, on the strength of
their expiry. Both were wrong, and in the same way: **expiry bounds age, not
quantity.** A thousand invites at fifteen days is still a thousand invites,
so a relay whose owner mints freely accumulates **standing** invites — the
unclaimed ones — until something stops it.

By the rule in §8 (*any persisted dataset is bounded by disc space or a
disc allotment*), they get one: a space allotment with **oldest-first
eviction**. The 15-day ceiling stays, as policy inside that bound.

**And the rolls need the mirror of that, which they do not have
(added 2026-09-20).**

> **Andy:** *"the roll was defined as bounded by disc space, but that
> fails to evict stale members if there's too much disc space
> available."*
> **Andy:** *"the disc space limit must be enforced out of principle, but
> we need staleness eviction or the member roll stays frozen. similar for
> partners."*

**Out of principle** — the allotment stays whatever else is added; §8 is
not weakened by giving age its own bound. And **frozen** is the exact
failure: on a roomy disc nobody is ever flushed, so a full roll admits no
one new and releases no one old. It stops turning over.

The invite case above establishes that **expiry bounds age, not
quantity**. This is the same argument run backwards: **quantity does not
bound age.** The roll today has a space allotment and longest-inactive
flushing (§ *member storage*), which is eviction *under pressure* — so on
a roomy disc the pressure never arrives, nothing is ever flushed, and a
member who vanished two years ago still holds their seat and their name.

Invites got both bounds. The member roll got one. Two causes of eviction
are needed and they are not two flavours of the same thing:

| | evicts when | bounds |
|---|---|---|
| **allotment** | the space is wanted by someone else | quantity |
| **staleness** | a seat has gone unused for long enough | age |

Neither substitutes for the other, which is precisely what §8 already
says about every other persisted dataset.

**Open, and not decided here:** what the staleness ceiling is, and
whether a newcomer may evict the stalest seat on demand or must wait for
one to lapse. Those are different admission policies — *"be active or own
your own relay"* points at the first, *"only accept new members when an
old one expires"* at the second — and they give opposite answers to
whether a popular relay can be joined today.

**One constraint either way: eviction spares the owner.** Ownership is
first claim and the roll no longer records who owns the relay, so a relay
that flushed its owner's row would leave `allow.json` as the only proof —
which is SSH recovery by hand (`AGENT.md`). The same exemption the
Governor already makes when it sheds streams.

**The partner roll has the same gap, and a stale partner costs more than
a stale member.** Its rows are *"bounded by a disc allotment and flushed
under the roll rules: a rolling window, longest-idle first"* — pressure
again, so a roomy disc freezes it the same way. But a stale member is
**passive**: it holds a seat and a name and is never asked for anything.
A stale partner is **active** — it stays eligible for route hints and for
forwarding, so the relay keeps *trying* it, and every attempt is a held
route waiting out its timeout. Staleness there is paid in the request
budget, not only in disc.

The `requested` / `partnered` partition already established here applies
unchanged: the two life cycles want different staleness ceilings, because
a proposal nobody answered and a partnership that has gone quiet are
different kinds of old.
Which gives the general form the other windows were already obeying without
it being said:

> **A time bound is not a space bound. Every window needs both.**

The roll has this — `N` bounds age, slaved to its allotment, which bounds
quantity.

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

*(An earlier version tied this to a "monitor-side rule" for owner
adjustments; owner adjustment at runtime is outside this design — §5,
scope.)*

| | bounds set by | position set by |
|---|---|---|
| **resource levers** — caches, rates, connections, roll expiry | owner, in the configuration file | Governor |
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
lands on the Governor's one input, its programming (§5, scope). So **the ladder order is what a
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
| partner roll | rows warmed by hints | all of it, own allotments per status (§5) |

*(This row read "route cache"; withdrawn 2026-09-19, routes are the node's.)*

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

**In the three levels of §8, the derived `N` is the lever's ceiling.** The
configuration (the roll allotment) sets it; the Governor positions `N` at or
below it, never above. That is the sense in which `N` is "a Governor's lever"
(below) and "slave to the allotment" at once — *this reconciles two
statements an earlier version of this note left side by side.*

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

**Identity and `allow.json` need no allotment of their own.** They do not
grow, so they need no lever and no policy — the disk equivalent of the
executable, bounded by actual disc space and never thought about.

*This corrects an earlier version, which also filed `invites.json` here as
bounding itself by expiry. Expiry bounds age, not space; invites have their
own allotment (above).*

Which gives the rule that keeps the configuration small:

> **Every persisted dataset is bounded by disc space or a disc allotment.
> Only what grows needs an allotment of its own.**

The roll, the invites and the partner roll (§5) grow. Identity and `allow.json` are
constant, bounded by the disc they sit on — and that is the whole of the
disk configuration, which matters because §8 makes this the first
configuration a relay has ever had and the precedent should stay as narrow
as it honestly can.

So the split is **not incompressible versus compressible — it is two windows
at different speeds**, each with its own allotment and its own lever:

| allotment | cycle | what pressure does |
|---|---|---|
| roll | months | shortens `N`, the inactivity drop |
| partner roll, `partnered` / `injected` | long | longest-idle first |
| partner roll, `requested` | short | longest-idle first, within its own allotment |
| invites | ≤ 15 days | oldest first |

*(This table had a route-cache row; withdrawn 2026-09-19, routes are the
node's. The argument below was first made with the route cache as the
high-churn store; it now applies to `requested` partner rows.)*

**And it has to be a split rather than one pool**, because of the failure a
single pool produces: ranking by recency inside one budget means **the
high-churn store always wins**. A high-churn store — now `requested` rows,
which any stranger can create — turns over constantly while the roll barely
moves, so one busy week would evict *members* — the slow-moving thing
starved by the fast-moving one, which is exactly backwards.

That is the same reason §9 **reserves** monitoring rather than ranking it:
monitoring is low-churn, workload is high-churn, and one ranked pool sheds
the monitor first every time. So both resources obey one rule:

> **Partition by life cycle. Do not rank across life cycles.**

Each partition gets one lever, bounded, and the two never bid against each
other.

The Governor operates on the second half of each. *(A paragraph here argued
the disk route cache was compressible; withdrawn with the cache,
2026-09-19.)*

**Disk belongs in 0013's ranking, and it is second.**

> **Andy:** *"I've been looking at VPS pricing resources, from most
> expensive down: RAM, DISC…"*

[0013](../decisions/0013-a-relay-is-fixed-cost-per-time-unit.md) ranks three
resources — RAM expensive, CPU and bandwidth cheap — and **does not mention
disk**. It should, and this is the fourth row.

*Superseded 2026-09-19 from here to the recommendation below: the relay
keeps no route cache (§9b, routes are the node's), so 0013's "broadcast
rather than cache" needs no reinterpretation. Disk still belongs in 0013's
ranking, second. Kept as the record:*

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

**Recommended:** amend 0013's resource table to four rows. *(The second half
— "broadcast rather than cache was decided against a RAM cache" — is
withdrawn with the route cache.)*

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
chosen as insurance rather than required.

*Updated 2026-09-19: this section was written when the relay was to keep a
disc route cache, its one large rebuildable store. With the cache withdrawn
(§9b), what remains on disc is nearly all durable. The principle below
stands — do not pay to preserve what rebuilds — but the two-store argument
has lost its main case; whether `requested` partner rows justify a second
store is open.*

The sharper consequence is not that disk is dearer than said. It is that
**a cache should never be backed up at all** — it is reconstructible by
definition, which is what makes it a cache. Paying daily to preserve
something that re-verifies itself on next use is waste with no upside.

So the relay's storage splits by **backup-worthiness**, which is not the
same axis as size:

| | contents | backed up |
|---|---|---|
| **durable** | `identity.json`, `allow.json`, the roll, live invites | **yes** — losing these loses the relay's identity and its members |
| **ephemeral** | ~~verified-route cache~~ (withdrawn), meter, decision buffer | **no** — every one of them rebuilds |

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
discipline as §8 (*DISC_LIMIT*) and §9, arriving at a fifth resource nobody had listed.

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
trend needs the permanent record — which lives on the owner's node (§8, *the decision record is not a relay store*).
That record holds **counts over time** (roll size, active members), never
the members themselves: the owner does not duplicate member storage (§2).
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
hard bounds (never 0, which would evict everyone; never above what the roll
allotment affords — the derived ceiling, above). And your framing keeps it out of the shedding
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

It also reaches other members' nodes — a contact's route (§9b) will point
at a relay the peer is no longer enrolled at. The forward fails, and the
node searches again. *(This read "other relays' verified-route caches";
corrected 2026-09-19, routes are the node's.)*

**The roll allotment is what makes membership finite.** *This corrects an
earlier version, which said the roll was incompressible and let it squeeze
the cache.* The roll has its own allotment and never bids against the cache
(§8, *partition by life cycle*); under pressure `N` shortens, and only past
the hard floor does the allotment bind against enrolment itself. That puts a
number behind the shedding ladder's *refuse new claims* rung
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

### The Governor has one input: its programming

> **Andy (2026-09-19):** *"This design does not include or consider the
> owner's node moving levers remotely and/or interactively. The governor
> will be a result of programming."*

*This supersedes an earlier framing of two inputs — programming now,
monitor-side lever adjustment "later". Adjustment is not deferred inside
this design; it is outside it. The reasoning below is kept as the record,
for whoever opens that question as a separate design.*

> **Andy (earlier):** *"The Governor's behaviour has two potential inputs:
> programming AND monitor-side lever adjustments, which are more tricky and
> for later."*

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
decision nobody witnessed is one nobody can disagree with (by changing the
programming, offline), which is the same
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
it would buy — which needs the cost model (§8, *disk belongs in 0013's ranking*) and the decision record (§4)
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
> — [relay.js:2629](../../spirit/run/js/relay.js#L2629)

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

### Routes are the node's: a contact's relays, as location

> **Andy (2026-09-19):** *"The 'routes' associated with a node's foreign
> contacts (contacts that are not enrolled on the same relay) should be
> listed in the contacts of a node as relays; they are always the ID of the
> relay it is enrolled at."* — *"When a member sends its relay a
> peerPost(), accompanied by route hints, the route hints are actually more
> like an address-prefix, or 'location', like a domain in DNS."*

**Decided.** A route is **the relay a contact is enrolled at**, stored on
that contact's row in the node's own contacts, by the relay's **ID** (its
key). It is location, not identity: the contact's key says who they are, the
relay says where they are reached, and a contact who moves relays keeps
their identity. A contact enrolled at several relays has several.

On the wire it is the **route hint**: sent beside the `peerPost`, signed
separately, consumed by the first hop (SURFACE.md §8) — envelope, not
letter. The member's relay reads it as a partner key, loads that one
partner-roll row, and forwards. That is the `atRelayKey` above, supplied at
last.

**So the relay keeps no route cache.** A relay storing *"peer K is at
foreign relay B"* would be persisting a partner's members, which 0012 made
structurally impossible. The node, which pays for its own disk, holds the
routes — 0013's *growth lands on nodes*. The cost is 0012's already-accepted
one: a post to a contact with no known route needs a search first.

**A hint naming a relay that is not my partner starts a minting cycle.**

> **Andy (2026-09-19):** *"Those hints will trigger a partner-minting cycle,
> starting with the owner of this relay."*

**Decided.** The member's relay treats the hint as a partnership request and
streams it to **its own owner** first — the same cycle as §5, begun from the
inside. If the owner injects, the relay proposes, and the far owner is asked
in turn.

The post is refused at once with **"minting incomplete"** — nothing holds
it (0006) — and the cycle starts after (tiers, below: decided).

**Recommended, not decided:** the row this writes is short-cycle and not yet
owner-signed, so it takes the `requested` allotment; and the §5 rate gate
covers it, or a member could flood the owner's stream.

**Several hints: the relay uses open routes first.**

> **Andy (2026-09-19):** *"When several hints, the RELAY uses open routes
> first."*

> **Andy (2026-09-19):** *"The relay tries the ones naming its current
> OPEN/LIVE partners first."*

> **Andy (2026-09-19):** *"1. live partners 2. minted partners
> 3. non-minted, immediately returns error ('minting incomplete'), then
> triggers minting cycle with its owner."*

**Decided.** When a post carries hints, the **relay** tries them in this
order:

1. **live partners** — partnerships open right now; nothing more to pay
2. **minted partners** — both owners have signed (`partnered`), but not live;
   costs a connection
3. **non-minted** — the post returns an error at once, **"minting
   incomplete"**, and the relay then starts the minting cycle with its own
   owner

Tier 3 is reached only when no hint is live or minted. A row only this
relay's owner has signed (`injected`) is tier 3 as well — the far side would
fail the handshake — but by §5's closing rule it is **not** streamed to the
owner again: the relay proposes to the far relay instead — it **attempts to
complete the minting cycle** its owner already began. The relay decides the
order because it is the party that knows which routes are live.

*This corrects an earlier version of this note the same day, which gave the
ordering to the node and had the relay follow it.*

**Already half in the tree.** Contact rows carry `relays: [...]`, and
`learnRoute` stashes a route a relay has proven onto an existing row and
never creates one ([contacts.js:411](../../spirit/run/js/contacts.js#L411)).
The divergence: the tree stores relay **URLs**; this decision says relay
**IDs**. *Resolved by cycle 2: contact rows gain `routes`, relay keys only,
and `learnRoute` writes there; `relays` (URLs) is left as it was.*

### The member who answers learns the route back

> **Andy (2026-09-19):** *"If N2 accepts the request and subsequently wants to
> send a request back ... it wouldn't be able to supply appropriate hints."*
> — *"Any 200 reply from an N2 may merit sending the route back to N2."* —
> *"The timestamp is added by N2 upon receipt of the route through the
> sseReader."* — *"The most recent timestamp should give a route priority to
> a degree, and requests should supply the hints in priority order."*

**The gap, as it stood at `c386344`.** Cycle 2 teaches routes in one direction
only: A, the asker's relay, broadcasts `('route', { key: N2, at: B })` once N2's
signed reply comes back. B hands N2 the forwarded request as
`{ from, to, text, sig }` ([relay.js:1931](../../spirit/run/js/relay.js#L1931))
and says nothing about A. So N2's own request back to N1 goes out without
hints.

**Decided (Andy, 2026-09-19):**

- **B sends the route when it answers the reply.** When N2 posts a signed
  reply to a request that arrived through a partner, B answers that post with
  a 200. In the same step B sends **N2 alone** a `('route', { key: N1, at: A })`
  event on N2's stream.
  - The event and its shape are the ones cycle 2 already uses, so nothing new
    goes on the wire.
  - B does this on *any* signed reply. A reply has no status: every request
    gets a receipt, and whether N2 took it in shows only in the reply's
    `text`, which the relay never reads ([peerPost.js:621](../../spirit/run/js/peerPost.js#L621)).
    Either way, the partnership carried the request both ways, so the route
    is proven.
- **B still keeps no route cache.** The partner's key for a request is held
  in memory only while that request is in flight, like A's `carrying`, and it
  is removed when the reply arrives. Nothing is written to disc. §9b's "the
  relay keeps no route cache" stands.
- **The node decides what to keep, and stamps when.** Routes arrive through
  the existing path (presenceNode `onRoute`, then `learnRoute`).
  - For a contact, the route becomes newest, and N2 stamps `seen` with its
    own clock. The relay never supplies a time.
  - For a stranger, the route is dropped, as before.
  - Routes learned from A's broadcasts get the same stamp.
- **Hints go in priority order.** The node sends a contact's routes as hints
  sorted by `seen`, newest first, capped at `HINTS_PER_POST`, so the cap keeps
  the freshest. The relay's tiers still decide first: live, then minted, then
  non-minted. Within a tier, the node's order decides. That is the "to a
  degree": a live older route beats a newer one that is not live.
  `partnerFromHints` already takes hints in their given order within each
  tier ([relay.js:2685](../../spirit/run/js/relay.js#L2685)).

**Evidence: the forward is the proof.** N1's post signature covers the minute
([relayAuth.js:135](../../spirit/run/js/relayAuth.js#L135)) and is accepted
within ±1 minute ([relayAuth.js:147](../../spirit/run/js/relayAuth.js#L147)).
A partner forwards only a post from its own member, enclosed whole. So a
fresh packet from N1 that A carried shows that N1 is A's member and posted
there just now. The only way round it is for A to replay a packet it got
elsewhere within that window. That is a partner breaking the partnership, and
B's trust in A already rests on both owners having minted it.

*Andy: "Isn't the proof that N1 is there implicit in the fact that A forwarded
N1's request to B?" Yes. This corrects an earlier note, the same day, which
called B's evidence weaker than A's because no signature from N1 proved N1 was
there. Both bars prove presence: at A a signature from the target, at B a
fresh signature from the originator, carried by a minted partner.*

**For Grok's batch review:** `seen` changes the contacts schema, from
`routes: ['key', …]` to `routes: [{ at, seen }, …]`. Andy has decided it, and
that is enough to build it. Grok sees it in the batch review, which comes once
all the design that started with Grok is built and passing. *(Andy,
2026-09-19: requests to Grok cost money and copy-paste time, and this
conversation finds discrepancies faster. This corrects an earlier note, the
same day, that held `seen` until Grok had seen it.)*

**Open:**
- Whether to also broadcast the route to B's other members, as A does. It
  would reach anyone else on B who holds N1 as a contact. The cost is that it
  tells B's members that N1 talked to someone on B.
- Whether a route not seen for a long time should stop being sent as a hint.
  No threshold is proposed; that is for measurement.

**Built, the relay half:** cycle 3 Part A, R9. Andy: *"Now, because it
should've been in the Part A cycle."* B sends the route to the member who
answers, and the node applies it through the existing `learnRoute`. **Still
to build:** `seen` and ordering hints by it (decided, not blocked).

*This replaces "scheduled after cycle 3 Part B, as a small cycle of its
own", written earlier the same day.*

### A warm partner row carries an outstanding-post count

> **Andy (2026-09-19):** *"Since multiple node-IDs can be reached through a
> single relay (route), optimisation would demand that in-RAM routes have an
> active-user count."* — *"A count. Yes."* — and then: *"There's a count of
> outstanding posts (incremented at forwarding time and decremented when the
> corresponding hash arrives back on the stream). The count by member is way
> more complicated — on the relay side it would require an extra record for
> every member currently using that partner. But an active post count for
> the member alone can be kept cheaply."*

*This supersedes an earlier version the same day, which counted distinct
active members per partner and recommended an approximate sketch to do it
without a list. Counting distinct members needs a record per member per
partner; counting posts in flight needs none.*

**Decided.** Two counts, both of posts in flight, never of people:

| count | +1 | −1 |
|---|---|---|
| **per partner row** (warm in RAM) | forwarded through that partner | its hash comes back on the stream, **or it expires** |
| **per member** | the member posts | the same |

**Already in the tree.** [router.js](../../spirit/run/js/router.js) holds
`pending[hash]` with its requester and time, expires it, and caps it —
`countFor(requester)` is the per-member count, capped at
`DEFAULT_PER_REQUESTER 16` within `DEFAULT_MAX 256`. The per-partner count
is the same table grouped by partner: no new record, bounded by the cap.

**Expiry must decrement too**, or a reply that never comes back inflates a
count for ever.

It serves two jobs:

- **Unloading.** A warm row with nothing in flight may be dropped — no reply
  can be lost. **Recommended:** after an idle grace *T*, or a partner in
  steady use with fast replies touches zero between posts and thrashes.
  *T* is a lever; its floor and ceiling are **open** (§10).
- **Shedding.** Under RAM pressure, partners with the fewest posts in flight
  go first.

  > **Andy (2026-09-19):** *"A consideration in RAM-shedding: how many
  > active routes will be lost? A high active-count on a route must be shed
  > later than a lower count."*

  So the **cost of a shed is measured in posts in flight lost**, and that is
  the number a decision record reports for it.

**A count, not a list,** because a list of which members use which partner
is a correspondence graph — who talks to whom — even in RAM. It replaces the
"shedding fan-out" list in the superseded section below.

### A member at the ceiling is a shedding signal too

> **Andy (2026-09-19):** *"A member constantly being at the ceiling for
> open/pending requests may be cause for shedding just as much as having NO
> open/pending posts. The details may have to be deferred: learned when
> stress testing implementations."*

**Decided in principle, details deferred.** The per-member count has two
ends worth acting on: **zero** (idle — costs a connection and uses nothing)
and **pinned at the per-member ceiling** (consuming a disproportionate
share of the pool). Both are candidates for shedding. How long "constantly"
is, and which end goes first, are **deferred to stress testing** — measured,
not guessed.

### ~~Verified routes are worth persisting; referrers are not~~

*Superseded 2026-09-19 by "Routes are the node's", above: the relay keeps no
route cache. Kept as the record, and because its privacy argument (store
where, never who asked) still holds on the node side.*

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

### ~~This amends 0013's "never persisted"~~

*Withdrawn 2026-09-19: with routes on the node, there is nothing for a relay
to persist, and 0012/0013's "never persisted" stands unamended. The
reasoning is kept as the record; the Open item at its end — the roll's
store — still stands.*

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

### Limits exist only where a resource runs out

> **Andy (2026-09-19):** *"It's unnecessary usage ceilings that I think are
> fascist."* — *"I see a reason for hard floors on levers: the
> MINIMUM_RESIDENT_ROUTES_PER_LIVE_CONNECTION. I see no reason for hard
> ceilings, not even per member count. The ceilings must be re-computed by
> events, like: a third member joined, let's divide non-owner RAM by 3
> now."* — *"Connected."* — *"Owner allotments must be fixed (super-user),
> because there needs to be space for diagnosis and monitor captures, to
> ship better code on the next deploy."*

**Decided.** *This corrects "1 is the hard ceiling" below: the top of a
lever is a moving share, not a fixed number.*

- **Hard floors stay** — each is a guarantee somebody relies on.
- **No hard ceilings on levers, not even per member.** The only fixed bound
  is the configured one (box → configuration, §8).
- **Shares are recomputed on events**, not on a clock: when a member
  **connects** or **disconnects**, non-owner RAM is divided again among the
  members connected now. Twelve members on an idle relay get the whole relay
  between them; one member alone gets all of it.
- **The owner's allotment is fixed** — a super-user reservation off the top,
  for diagnosis and monitor captures, so the next deploy ships better code.
  It is the same reservation §9 makes for monitoring, and it is never shed.

**What it condemns in the tree** — fixed per-sender caps, due to become
derived shares: `DEFAULT_PER_REQUESTER 16` and `DEFAULT_MAX 256`
([router.js](../../spirit/run/js/router.js)), `MEMBER_PER_MIN 600`
([relay.js](../../spirit/run/js/relay.js)). And cycle 1's connection
allowance ceiling (`ramLimitMB × STREAMS_PER_MB`), which is still a fixed
derivation rather than a share of what is left after the owner.

**The use cases that forced it** (Andy): a relay giving 1,000 friends private,
verified connectivity; a relay as the owner's own big pipe, reaching 1,000
people bound to other relays; a small group of workstations syncing process
status everyone-to-everyone in real time. All three are served by shares that
grow when the relay is quiet. **Open:** the second and third also want a
**group post** — one message, many recipients — which is a new way of
speaking (0010) and Andy's to decide; and a partner relay counts as one
sender today, so a partnership would share a single sender's budget.

### Every lever declares its floor and its ceiling, with the reason

> **Andy (2026-09-19):** *"The levers available to the governor must have
> floors defined by considerations such as: for non-member identities, there
> must be at least one route for partner-routing. Every proposed lever must
> define floor and ceiling considerations."*

A floor is not a number anyone picked. It is **what must still work at
position 0**, and a ceiling is **what the configuration can afford at
position 1** (§8's three levels). A lever proposed without both, each with
its reason, is not ready to build.

Andy's example is the partner lever's floor: at position 0 a non-member
identity must still have at least one route through a partner. That is a
stronger reason than the bootstrap deadlock above, and it gives the same
answer — the floor is never zero.

The levers this note names, and what is known of each:

| lever | floor — what must still work | ceiling — what bounds it |
|---|---|---|
| partner allowance | at least one partner route for non-member identities; never zero (bootstrap). Today 60/min | the RAM workload allotment — **open** how it is derived |
| roll `N` | never 0, which evicts everyone. **Open:** expiry must be recoverable first (see *the roll is a window too*) | derived from the roll allotment (§8) |
| invite lifetime (act lever) | 1 day (`normalizeDays`) | 15 days; the Governor may lower it, never raise it |
| ~~route cache~~ | *withdrawn 2026-09-19 — routes are the node's (§9b)* | |
| partner roll, `requested` (§5) | **open** | its own allotment |
| idle grace *T* before unloading a warm partner at zero in flight (§9b) | **open** | **open** |
| "constantly at ceiling" for a member (§9b) | **deferred** — stress testing | **deferred** |
| connections (`DEFAULT_MAX 256`) | **open** — candidate: the owner's own stream, which §9 reserves as overhead | the RAM member-roll allotment |
| meter slots | `METER_SLOTS_MIN 20` — *"smaller and slower" never becomes "blind"* | the monitoring reservation (§9) |
| `MEMBER_PER_MIN`, `CLAIM_PER_MIN`, `DEVICE_PER_MIN` | **open** | **open** |
| unsolicited partner proposals (§5) | **open** | **open** |
| request timeout — ~~a Governor lever~~ **superseded 2026-09-21: a 5 s code ceiling, and the effective value is carried per request** (Andy: *"the relay has no business waiting for 15 seconds"*, *"the willing to wait time in a request is informational"*). The row's own third column already argued it — *"the asker's remaining wait"* is exactly what now travels in the envelope. `requestTimeout1` is not a lever: `0016` first demoted it to a latency lever, and this removes it. The router's ttl, today `DEFAULT_TTL_MS` 20 s | the measured round trip of the path with a margin; below it, legitimate replies are cut. Measured: 365 ms for one relay through spirit-3; a partner tunnel has **not been measured** (estimate ~2×) | the asker's remaining wait: holding longer keeps state for somebody who has gone |

The open cells are the work that has to be done before those levers are
built, not after.

**The request timeout, noted (2026-09-19).** It bounds everything a request
holds. Cycle 3 made that true: a forward's partner answer and route back
ride in the router entry and expire with it (`router.open`'s `carry`). Before
that they sat in a side map that only a reply emptied, so it leaked. The
waits are **inverted today**: the asker waits 8 s (`peerPost`), a held route
15 s (`ROUTE_WAIT_MS`), the router 20 s. So relays keep state for up to 12 s
after the asker has gone. **Open:**
- whether waits nest (asker > first relay > far relay), and at what starting
  value;
- the measured tunnel round trip that sets the floor;
- once each relay's Governor moves its own timeout, nesting cannot hold by
  configuration. The asker's deadline would have to travel with the request,
  signed beside it like the hints. That is a wire decision, not needed until
  the lever moves.

**How the floor is found (decided, Andy, 2026-09-19).**

> *"While setting a fixed starting timeout of, let's say, 10 seconds, we then
> measure the performance of a clueless search (no routes yet) to n partners,
> which happens in parallel, and place the timeout floor in that
> neighbourhood … the hardcoded floor must be that measurement plus 1 second,
> or that measurement × 1.5 or so."*

1. **Start generous.** N1 waits a fixed ~10 s, with every inner hop nested
   below it, so no legitimate search is cut off while we learn.
2. **Measure the worst ordinary case.** A search from N1 with no known routes,
   which A fans out to all *n* partners in parallel (`Promise.all`,
   [relay.js:2614](../../spirit/run/js/relay.js#L2614)). It takes A's own walk,
   plus the slowest partner's walk, plus the trips. So it grows with *n* and
   with the largest partner roll.
3. **The hard-coded floor is that measurement + 1 s, or × 1.5**, whichever is
   larger. + 1 s protects a short measurement against jitter; × 1.5 scales
   with a long one.

*This corrects a proposal the same day that picked the numbers directly (N1 at
1–5 s starting at 3 s, the search assumed to take 2 s). The floor comes from
measurement, not a guess.*

**Known so far.** A roll walk, measured 2026-09-19 on the workstation: about
5.5 µs per member, so 10,000 members take 40–90 ms and 100,000 about 550 ms.
Since cycle 3 the walk goes a page at a time, with the event loop between
pages. The relay keeps serving while it runs, and the search takes its work
time plus whatever it waits for. *(This replaces "the walk is synchronous, so
that relay handles nothing else while it runs".)* Localhost says nothing about real links: the measurement needs real relays
(spirit-3 and a second relay; lab never runs against spirit-3).

**The fan-out: live partners only, and its own budget tier (decided, Andy,
2026-09-19).**

> *"Special fan-out-at relay level posts must be subject to a different
> budget tier."* — *"… or the concept that peer acquisition for nodes
> requires liveness of the partners; this would accelerate search
> significantly."* — *"Search vs. census is already a loss in
> completeness."*

- **Live partners only.** A member's search is propagated only to partners
  holding their stream here right now (`presentNow.isPresent(relayKey)`,
  the same test hint routing uses). Today it asks every `partnered` row and
  waits on all of them (`Promise.all`), so one partner that is down holds
  every search for the full timeout. Relays dial their partners at boot,
  so a healthy partner is normally live. What is left out is mostly the
  partners that could not have answered in time. Leaving some members out
  was already accepted when search replaced the census.
- **Its own budget tier.** One member search becomes *n* partner posts.
  Today it costs the member one post from the ordinary 600 a minute, and at
  the partner it lands in the partner pool of 60 a minute, which every other
  member's forwards share. So one member searching once a second uses up A's
  allowance at every partner. Three levers:
  - **per member at A:** propagated searches a minute, separate from
    ordinary posts;
  - **relay-wide at A:** propagated searches in flight at once, which
    bounds RAM, since each one holds up to *n* entries;
  - **per partner at B:** partner searches in a pool separate from partner
    forwards, so a search flood cannot starve delivery.

  Floors: a member can always search now and then, because search is how a
  route is found when there is none yet. Ceilings: the partner pool and
  relay RAM. **Numbers open**, measured like the timeout.

**The measurement, when built.** A times each propagated search from start
to merged answer. It keeps the most recent value and the maximum, with *n*
and how many partners answered. It rides the owner report that already
exists, so nothing new goes on the wire, and cycle 4's monitor draws it.

### The lever object, its label, and its contract (cycle 4 planning, 2026-09-19)

**Decided (Andy):**
- **No lever is known in advance** — "today's set of levers is what we
  thought yesterday; tomorrow will bring…". Each lever declares itself in
  the report; the monitor, the ranking and the dialog never name one; a
  lever from a newer relay is still drawn, ranked and, if live, movable.
- **A shared lever module** (isomorphic, like `labelRule.js`) produces a
  **labelled object with a variable value**: the label fixed, bounds and
  `live` declared once, the value the one thing that varies, `set(v, why)`
  the only mutator (checks `canSet`, records the move). The Governor and the
  owner both go through `set`. The report is the object read out; the node
  rebuilds it with the same factory. On the wire: **one owner verb**,
  `{ lever: { name, set } }`, answered in `answerSelf`.
- **Levers have no ID, only labels**, restricted like an invite's label:
  **`^[A-Za-z]+[1-9][0-9]*$`** — the meaning in letters, then its
  iteration as the shortest form of a positive integer (`connections1`),
  within 32 characters; `labelRule.leverOk` layers it on `spokenOk`. A
  change of meaning takes a new iteration; a retired label is never reused.
- **Setting vs constant.** A *setting* is a live, temporary value — an
  experiment during a learning cycle, kept in `levers.json`, clamped to the
  bounds on load. A *constant* is what learning concluded, a final value in
  the Governor's program. **Programming controls and constrains the
  Governor, and tests assert it does not step outside.**
- **A setting below the present count is just a changed value**: the
  program reacts to the value, whoever set it (close the idlest, sparing the
  owner and posts in flight); the dialog only predicts that reaction.
- **Postulate, for now:** the sum of all levers does not threaten
  `PAYLOAD_MAX` per relay — held with a tripwire test (the report under a
  quarter of it), which catches growth in the shapes it builds.
- **The lever contract**, layered: a **generic base, lever-agnostic and
  generated** (random labels, bounds, values, signals and version skew),
  and **lever-specific tests on top**. The base is found by working the
  first real levers, not designed up front; it stabilises and sharpens over
  learn-reprogram-test rounds, and lever-specific tests retire with useless
  levers.
- **A lever's lifecycle:** declared → learned (settings) → a constant, or
  retired through the deprecation register (0014).

---

## Approach: cheap measurements first, then learn

> **Andy (2026-09-19):** *"Our approach in principle: first we only measure
> cheap measurements; that is enough to prove the overall design. The
> Governor will be simple. The monitor on the owner's node as well. Then we
> learn from the results."*

**Decided.** The first build measures only what is **cheap** — counts the
relay already keeps or can keep in a line (posts in flight, present, rss,
the meter) — and nothing that needs a new record per member. That is enough
to prove the design. The first **Governor is simple**, and so is the first
**monitor** on the owner's node. What they should become is learned from
what they show, not designed in advance — which is why details such as the
member-at-ceiling rule (§9b) are *deferred to stress testing* rather than
open.

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

### Cycle 1: two relays, two owners, and the harness is mandatory

> **Andy (2026-09-19):** *"For both relays, I believe what I see on one. And
> your end of the verification is a must. I'd prefer two relays, two owners,
> confirming to each other what must be there."*

*This supersedes the paragraph above on who owns the relays, and the
single-owner constraint before it.*

**Decided.**

- **Two relays, two owners.** Owner A owns relay A, owner B owns relay B,
  and the two relays are partnered (the old way, as a fixture — cycle 1
  scope).
- **Cross-confirmation.** Each side's report must show what the *other*
  side did: posts B's members send through the partnership appear in A's
  in-flight counts and meter, and the reverse. A panel that reads the wrong
  relay, or a count that never moves, fails because the other side knows
  what must be there.
- **The harness is mandatory.** The agent's verification — an automated
  test asserting the cross-confirmation — is required, not optional.
- **Andy watches, hands-off.** By eye, in the browser, during the live run
  below; the harness has already checked both relays, so what Andy sees on
  one is taken to hold for both.

**Proof of closing — accepted by Andy, 2026-09-19.** Cycle 1 closes when all
four hold:

1. **Harness test green.** One automated test drives both owners over
   loopback and asserts: each relay reads its RAM ceiling from its
   configuration file; each owner receives only its own relay's report, with
   differing roll sizes; cross-confirmation — B's posts appear in A's
   in-flight counts and meter, and the reverse; counts return to zero when
   replies arrive **or expire**; under the small ceiling the Governor sheds
   at least once and reports a lever position and a reason down the owner's
   stream.
2. **Live run, watched hands-off.** labMaster runs two relays and two owner
   nodes on the workstation; the agent drives the traffic as both owners;
   Andy watches both monitors in the browser and sees RAM and in-flight
   counts rise, at least one shed with its reason, and RAM fall back under
   the ceiling.
3. **No regression.** `npm test` green; the `oneDoor` census does not rise.
4. **Bookkeeping.** Every cycle requirement has a verification;
   `cycleRequirements.js` green.

It proves the design on loopback lab relays — not Caddy, TLS or spirit-3,
which stay unproven as the live-surface cleanup note records.

**Carried over, still required:** each relay's RAM ceiling small enough that
the Governor sheds; live traffic through the partnership, not only populated
rolls; different roll sizes on the two relays; labMaster and lab relays on
the workstation, never on spirit-3.

## Decided

**The two frames.** A node is a person and is readable because of it; a
relay is infrastructure and **owes its owner an account of itself, not an
inspectable disk**. Readability is the node's constraint, scoped by
STORAGE-PHILOSOPHY's own words.

**Routes are the node's** (Andy, 2026-09-19). A route is the relay a contact
is enrolled at, stored on the contact's row by relay ID — location, not
identity, like a domain in DNS. It travels as a route hint beside the
`peerPost`. The relay keeps no route cache (§9b). Each warm partner row and
each member carries a count of **posts in flight** — +1 on forward, −1 when
the hash returns or expires — never a list of people. A partner at zero
unloads; under pressure, fewest-in-flight sheds first. A member pinned at
its ceiling is a shedding candidate as much as an idle one; the details are
deferred to stress testing (§9b). The relay
tries hints in three tiers — live partners, then minted partners, then
non-minted, which returns "minting incomplete" at once and starts the
minting cycle with this relay's owner (§9b).

**Scaffolding before optimization** (Andy, 2026-09-19): hints end to end,
SQLite, the first-claim token and installer, the owner's visual monitor —
then levers and tuning. See *Build sequence*.

**The first claim needs an invite too** (Andy, 2026-09-19), minted by an
interactive installer over SSH; amends 0003 to *first invited claim is
owner* (§5).

**Limits exist only where a resource runs out** (Andy, 2026-09-19). Hard
floors stay; no hard ceilings on levers, not even per member. Shares are
recomputed when a member connects or disconnects — non-owner RAM divided
among those connected. The owner's allotment is fixed, a super-user
reservation for diagnosis and monitor captures (§10).

**Cheap measurements first** (Andy, 2026-09-19). The first build measures
only what is cheap, which is enough to prove the design; the first Governor
and the first monitor are simple; the rest is learned from the results.

**Cycle 1 scope** (Andy, 2026-09-19). Proven by the fixture in *How this
gets verified*: two relays on local ports, **two owners** confirming each
other's traffic in an automated harness test (mandatory), and Andy checking
one relay on the monitor.

| in | deferred — learned from cycle 1's results |
|---|---|
| a configuration file carrying a **RAM ceiling**, which the relay reads and stays under | DISC_LIMIT and every allotment — roll, invites, partner roll |
| **cheap counts**: posts in flight per partner and per member (`router.js` `pending`), `present`, `rss`, the meter — all on the existing owner report | roll expiry `N`, and recoverable expiry |
| a **simple Governor**: one lever, the **connection allowance**; one remedy, close the **longest-idle** streams — reporting each move as a lever position and a reason. *Corrected while planning (Andy, 2026-09-19): this read "shed fewest-in-flight partners first", but shedding a partner frees almost nothing, and member streams are what hold RAM. See [the cycle](../cycles/2026-09-19-relay-governor-cycle-1.md).* | the monitoring reservation (§9) |
| a **simple monitor** on the owner's node: the activity and lever-position panels (§4) | `node:sqlite`, the index, lazy loading, the backup split |
| | floors and ceilings of every lever cycle 1 does not move |
| | decision records beyond the simple one |
| | version tolerance (§7) — deferred knowingly: cycle 1 ships node and relay as one commit, so they cannot skew yet. *"Or not"* still holds: this is the one deferral whose cost grows with time, and it is due before the two ship separately |
| | **partner acquisition** — injection, both-sign, the minting cycle, the partner roll, route hints as IDs. *"It has no direct bearing on load management."* |

**Cycle 0 comes first: the startup split** (Andy, 2026-09-19). Node and
relay become separate startup modules (Open, *one tree or two*) **before**
cycle 1, as its own small cycle — so cycle 1's RAM ceiling and shedding are
measured on a relay that no longer carries node code, and labMaster's
`--relay` spawn changes once. Done when behaviour is unchanged, the relay
loads fewer modules (measured by the dependency document's method), and the
harness is green. It touches `server.js` structurally; **Andy decides** who
writes it and how, before it is written — **decided 2026-09-19: Claude
writes it**, in the checkout, harness green.

With acquisition deferred, cycle 1's fixture forms partnerships the **old**
way. That is use of the deprecated model as a test fixture only — it is not
extended, and it still goes once §5 is proven.

**Standing rule: a relay manages its most expensive resource, RAM, with
utmost care** (Andy, 2026-09-19). Nothing is resident that current activity
does not need.

**Completeness is a trap** (Andy, 2026-09-19): *"The concept of 'complete'
datasets like the census is a trap. Life will always require decisions made
from incomplete information … with member and partner rolls expiring and
shed, nothing is 100% true."* And its capstone: *"A windowed roll will only
ever be searched — 'what can I recall that's useful' — and we offer the user
those choices. Period. No planning for 'knowing it all'."*
- **Every lookup is a search** — members, partners, invites, the owner's own
  roll, the node's contacts, routes. None is complete truth.
- **Every answer is best effort** — capped, dated, saying what it could not
  cover; `more` means "ask more specifically", never "next page".
- **Rolls are never enumerated**, not even in pages (the whole roll in
  slices is the census by another route — 0012 by symmetry, for partners and
  invites too). The report carries counts; rolls answer bounded questions.
- **Discovery searches live participants only** — "active participants are
  the most precious". Member search walks the cache of connected members'
  rows, never the disc.
- **We design how we act, not how we would know**: every action works on a
  partial answer, and plans carry no guarantees — **every cycle document
  states its anticipated failures**, and what the user sees when each one
  happens.

**"Our willingness to throw out stale data is what keeps us alive"** (Andy,
2026-09-19). Forgetting is a feature to build and test: shedding is asserted
as correct behaviour, and a proposal to keep data "for later", or to grow a
dataset without a disc bound, argues against this and usually loses.

**"We design to do the best with what we find. We won't be bothered with
what we can't find or know"** (Andy, 2026-09-19). Relays offer one way to
find nodes or relays: **search**. What is not found does not influence
decisions. *"Every internet/email user knows: email addresses change,
contacts go stale. Deal with it."* Searches can still be improved. What does
not change is that nothing waits for a list it cannot have. The first case:
hub.js swept every contact against an owned relay's roster. After the census
went on 2026-09-18, that roster read empty, and the sweep pruned every member
contact. It was deleted rather than guarded, and so were the fields it wrote
(`memberOf`, `missingSince`) and the UI drawn from them: the lock column, the
padlock and the "dud" warning.

**Nodes have two sources of knowledge: search (active) and broadcasts
(passive)** (Andy, 2026-09-19). This is why relays broadcast what they know.
A new member of a relay I own becomes a contact on the claim event itself
(`hub.adoptClaim`, called from server.js `onOwnerEvent`), not from a sweep.

**Membership can only expire, not be demoted** (Andy, 2026-09-19). On the
relay, a member row is shed or removed and never lowered. On the node, a
contact's `acquiredVia` rank only rises (contacts.js `ACQUIRED_RANK`, with
`member` at the top). It records how the person came, which is history, not
a claim that they still hold a seat.

**Ownership is one key, and no row knows it** (Andy, 2026-09-19): *"Only
one thing determines ownership of a relay. First claim. No fleeting roll
with automatic memory loss can mark a row as 'owner' … ownership is only
determined by one identified key. The relay knows it. The owner, if not
too forgetful, might know it too."* That key is `allow.json`'s, served at
`GET /api/relay/key` (`ownerPublic`), and the node's badge is a comparison
with its own key (`ownerBadge.probe`). The `members.owner` column went the
same day, dropped from an existing relay.db when it opens; nothing on the
wire marks a row as the owner's.

**What you stay connected by: being active, or owning your relay** (Andy,
2026-09-19). The consequence of the two rules above and of shedding: an
inactive member is not found by search, and their seat eventually expires
under the roll's disc bound; the owner's key is in `allow.json` and is
never shed. It costs less than it sounds — anyone holding your key in
their contacts still reaches you whenever you are online; what goes is
being discoverable. *Stated, not yet built: seat expiry — nothing sheds a
member row today (only `removePeer` deletes one), and no cycle piece
carries it yet.*

**The relay carries, the node stores, the shell understands** (Andy,
2026-09-20). Three layers, and the payoff is that neither of the lower two
has any idea what an app message means: *"there is such a large payoff
from node and relay not having a clue what app messages mean. It is a
successful boundary definition."* Verified at 5ac4fe4:
- **The relay parses a body in one place**, `answerSelf` — packets
  addressed to its OWN key. A packet addressed to a member is carried as
  `{from,to,text,sig}` byte for byte, including across a partnership. It
  reads what is spoken TO it, never what passes THROUGH it.
- **The node decodes the envelope and nothing inside it** (`v:1`, `body`
  — arrivals.js): it admits the sender, writes the traffic log, counts the
  peer's numbers and hands the message on. Structure, never meaning.
- **The shell and its apps supply the meaning** — a chat line, a caption,
  a file per peer.

**The worked example — chat's two check marks** (Andy, 2026-09-20, on the
WhatsApp shape): *"one checkmark next to a sent message means 'delivered'
and the second checkmark 'seen' is controlled by the remote node's
shell."* Each tick is emitted by exactly the layer that can know it:
- **one check, delivered** — the receiving NODE's bare receipt, given
  without reading the message (answerRelay.js: *"everything else on this
  wire is an app packet, and this node is not the one that reads those"*).
  With daemons it is a statement about their machine, not about them;
- **no check** — 503 `peer not reachable`. The relay holds nothing, so the
  sender is told at once instead of being told "sent" by something that
  dropped it;
- **two checks, seen** — an app packet posted back by the remote SHELL,
  signed by that peer like any other. The node cannot emit it (it does not
  know what "seen" means) and the relay cannot infer it;
- **therefore the "seen" control belongs to the remote person's shell.**
  Not a relay setting, not a node setting, and never a sender's demand —
  the layering hands us the right home for it.
- *Open for whoever builds chat's ticks:* a HELD sender. Their packet
  reaches a node that has a row for them and has not accepted them, and
  the line does not arrive. It must not receipt as delivered — and must
  not disclose the hold either, the same reasoning as the enrolment
  refusal that says nothing on purpose.

**The jobs a hub would do are distributed to the members, each scoped by
their own contact list** (Andy): addressing (the sender supplies route
hints from its own row; the relay picks only among relays it already
partners with), routing memory (a proven route lands on a row you already
have — a relay may improve your book, never add to it), presence (the
relay broadcasts, each node keeps the keys it knows and drops the rest),
naming (`myLabel` never leaves the node), and who may speak to you (held,
blocked, accepted — decided in the book, not on the box).

**What it costs, and we pay it:** no content filtering, no spam
heuristics, no search over messages, no unread count the relay could keep.
Each would need the relay to understand app messages. The relay's only
search is over the labels of connected members.

**The test for any new verb:** a verb the relay understands must be about
the RELAY — its levers, its invites, its partners, its own label. A verb
about app content never qualifies, however convenient. (Cycle 4's levers
add verbs, and all of them pass this.)

**Open, and the daemon cycle inherits it:** arrivals.js holds a packet
that arrives while no page is open — in the traffic log, until the first
page collects it, then forgets it. Correct while a node only ran when
somebody was using it; under the daemon rule below a node runs for days
with no shell attached, which would make the traffic log a message store.
The layering says where it belongs instead: the node keeps it as bytes
for an app, under a bound, and the app reads it when it next runs.

**The node pays attention; the browser only reads** (Andy, 2026-09-19):
*"The nicest thing: Jazz doesn't have to open a browser for me to see her
online. The personal node is chugging away, Jazz does whatever she wants,
yet her node pays attention."* A person's presence is their NODE holding
its relay streams (`presenceNode`, dialled from server.js at boot and
signed with the node's identity), never a page being open. Rules that
follow, and none of them bends for a screen:
- **Nothing a person relies on may require an open tab.** Presence,
  routes, the contact book, receiving a post, answering a search: all of
  it is the node's, and a page is a reader of what the node already knows.
- **A feature that would need the browser running belongs in the node**,
  or it does not exist. If a design cannot state who does the work with
  every tab shut, it is not finished.
- **Tests drive the node, not a page**, for anything in that list — a
  suite that can only assert it through a rendered screen is asserting the
  wrong half.

**So the personal node has to become a daemon** (Andy, 2026-09-19: *"the
personal node will have to become a daemon for it to be a viable
platform"*). **Decided, not built.** Today only the relay has a unit
(`bash/systemd/spirit-relay.service`); a node is started by hand and dies
with its terminal, which quietly makes the rule above false for everybody
but a machine somebody remembered to start. What it needs beyond what
cycle 3 already gave the relay (SIGTERM with the streams closed, exit 78
for refusals a restart cannot fix):
- it starts at boot and survives logout — a user unit with lingering, or a
  system unit;
- **Windows is the harder half and is where the work node lives** — a
  service or a boot task with no console attached, which nothing in the
  tree does yet;
- it holds the identity key and the person's own data, unlike a relay,
  which holds neither: an unattended node makes "what is on this disc, and
  how large may it get" a node-side question with a node-side bound;
- one instance per person, findable by the browser — two copies dialling
  the same relays are one person making two seats' worth of noise.

**What daemons are worth, on both sides** (Andy, 2026-09-20: *"demons will
give relays a much more stable set of connected-nodes. And from the
shell's point of view: green peers are listening and remembering."*):
- **To a relay:** a connected set that holds still. Members arrive when a
  machine boots rather than when somebody opens a tab, so presence churn
  falls, the roll of connected rows in RAM stops thrashing, and the
  connections lever becomes a question about steady-state RAM instead of
  about churn — which is the shape cycle 4 tunes against.
- **To the shell: green means listening AND remembering.** Not "somebody
  is at the screen" — that never was what it meant, and with daemons it
  cannot be mistaken for it. It means their node is up, will take the
  packet, and will still have it when they next look.
- **It is what makes "a relay stores nothing" affordable** (0006). A post
  to an absent peer is refused instantly, 503 `peer not reachable`
  (relay.js) — there is no store-and-forward on the box, by decision. The
  forwarding lives at the RECEIVING NODE, which can only be true if that
  node is up. Without daemons the rule costs real delivery failures; with
  them it costs almost nothing.
- **Small in-file work, when the daemon lands:** the contacts dot still
  says "a relay you share is holding their connection". The truer words
  are the ones above.

**Where it sits: its own small cycle, before beta** — the standing rule
that by beta Andy maintains his spirit dataset on the work node is only
true once the node runs unattended. Not cycle 4, not 5.1. Its first
question is Windows or Linux first, answered by where the node lives then.

**Search answers live participants; the node concludes the rest** (Andy,
2026-09-19): *"Search should respond with active/online members only. A
node can reconcile with its contact list to conclude that a contact is
offline (or dead, or currently rebooting…)."* The relay answers from the
connected members' rows it holds in RAM, so every row it returns is
present and none says so. What a node may conclude is bounded: not found
means *not found here, at this moment* — they may be on another relay, or
the answer may have been capped — so a contact goes stale rather than
false, which is the passive half's job too (presence broadcasts).

**spirit-3 is kept alive through every future cycle** (Andy, 2026-09-19:
*"practice our care for our relays … latest by beta I want to start
maintaining my spirit dataset on my work node, supported by my relay"*).
spirit-3 is production now, the work node by beta. Placed, not yet built:
every update keeps a way back (`bash/update` copies `relay.db`,
`allow.json`, `identity.json` aside first); every release is rehearsed on a
lab relay at the previous tag before it is tagged — which lowers the risk
and cannot remove it; lever experiments happen on a lab relay first.

**RAM conservation takes priority: caching goes to the route users** (Andy,
2026-09-19, ruled). Where a relay could hold something to help a member,
such as a route, the member's node holds it instead (§9b).

**Nothing on a relay blocks** (Andy, 2026-09-19): *"The nature of all wire
comms is asynchronous. And blocking hurts the resources of relays."* No
relay operation keeps the event loop for longer than a short, bounded turn.
Work that grows with the roll, such as search, is done a page at a time with
the event loop between pages. Cycle 3 made the search walk this way
(`walkRoll`, `relayStore` `members.page`). A synchronous walk of the whole
roll is for suites and tools only.

**The owner does not duplicate member storage** (Andy, 2026-09-19). A
relay's member roll and partner roll exist only on the relay; the owner's
node holds counts and decisions from the report, never the rows (§2). On
the relay, **DISC holds the full roll**, flushed automatically
longest-inactive first; **RAM holds only the currently active members**.
*True since cycle 3:* the roll is in `relay.db` and RAM holds only the rows
of connected members. *(This replaces "not true of the tree today:
`routingTable.json` is read whole at boot and the roll is resident".)* The
automatic flush, longest-inactive first, is not built yet.

**The node accumulates; the relay forgets.** Every relay store is a rolling
window. Its log already was — `trafficLog` writes nothing in relay mode —
and the roll is the last one to become one.

> **Vision, not placed in any cycle** (Andy, 2026-09-20): *"later, when
> Andy's node actually builds his spirit-vault, the media folder will become
> the input for Karpathy's method."* What the node accumulates is not an
> archive for its own sake — it is the material the collaboration is
> conducted from, the same reasoning that makes the dictionary an analysis
> of how Andy speaks rather than a glossary (`ANDYS_RULES_FOR_AGENTS.md`).
> *"Memory is the training set"* (0009) pointed at this already. Nothing is
> designed here and nothing is being built; recorded so the accumulation is
> understood as feeding something, and so that whoever bounds the node's
> disc knows what the person chose to keep is for.

**Three levels of constraint** (Andy, 2026-09-19): the **box** (physical RAM
and DISC) bounds the **configuration** (a file); the configuration bounds
the **Governor**. Each level may narrow the one above, never widen it (§8).

**Resources have one shape, applied twice:**

| | RAM | DISC |
|---|---|---|
| 1. fixed overhead | executable, V8, process, monitoring | identity, allow |
| 2. member roll | active members | the roll, long cycle |
| 3. cache history | partner rows warmed by hints, labels | none — routes are the node's |

- **Partition by life cycle; do not rank across life cycles** — or the
  high-churn store starves the low-churn one.
- **Every persisted dataset is bounded by disc space or a disc allotment**
  (Andy, 2026-09-19). Only what grows gets an allotment of its own: the
  roll, the cache, the invites, the partner roll. Identity and `allow.json` are constant and
  bounded by the disc they sit on. Expiry and inactivity rules bound age,
  not space, and run inside the allotment.
- **Allotments bound what is held; rate gates bound what is done.**
- **Monitoring is overhead, not workload** — reserved and bounded, so it can
  be neither shed to survive nor grown to see better.

**Levers.** `0` is the hard floor, `1` the hard ceiling, the position
between them is the Governor's, quantized in thirds or twelfths so the two
nest. Bounds are configuration; positions are choices. The roll's `N` is
one: its ceiling is derived from the roll allotment. **Every lever declares
its floor and ceiling with the reason for each** (Andy, 2026-09-19) — the
floor is what must still work at position 0; for the partner lever, at
least one partner route for non-member identities (§10). Two families:
**resource levers** (owner bounds, Governor positions) and **act levers**
like invite lifetime (Governor bounds, owner positions).

**Shedding.** Each resource has its own ladder with its own `n`, its own
members and its own order — the same event sits at different rungs, because
it costs differently in each. Order is programming, and programming is the
tuning surface that exists now.

**The owner governs partnership boundaries** by an allow-list of relay URLs,
permit and revoke; the relay chooses within it. Revocation is a boundary the
Governor cannot argue with.

**Injection is owner-only; the relay verifies and may reject** (Andy,
2026-09-19). An injected URL is a candidate: the relay checks it is an
actual relay and capable of partnership, and may refuse it; a rejection
reaches the owner with its reason (§5). An injection is a signed grant
that **delegates** to the relay the authority to partner with that relay;
with minting, it makes up the owner's real-time tools — signed grants of
admission.

**Both owners sign a partnership; no acceptance policy.** A proposal from a
relay the owner has not injected is streamed to the owner's node, and
answered by a matching injection; a proposal from a relay the owner already
injected is not streamed, which ends the cycle. Node-side handling is out
of scope (§5).

**The partner roll** holds every relationship as one row with a status —
`injected`, `requested`, `partnered` — bounded by a disc allotment and
flushed longest-idle first; `requested` rows have their own allotment so
strangers cannot flush partners (§5).

**Revocation is silent.** The revoking side forgets the far relay and sends
nothing; the far side learns by a failed handshake and marks its row.
Courtesy is out of scope (§5).

**The old partner acquisition model is rejected and deprecated** (Andy,
2026-09-19) — the peer-row flag and its promotion verb go once this design
is proven (§6).

**Relays get a partner interface whose objective is self-management**
(Andy, 2026-09-19) — forming, keeping and ending partnerships without a
human, inside the owner's candidate list (§5).

**Scope** (Andy, 2026-09-19): the Governor is the result of programming. The
owner's real-time tools are signed grants and **levers that declare
themselves live-changeable** — through the lever configuration API, persisted
to `levers.json`. **Higher-order limits** — the box and the configuration,
including anything protecting other servers on the box — are read once at
startup and never changed by the owner at runtime (§5). *Corrected the same
day: this first said the owner never moves a lever.*

**The baseline is an entry-level VPS**, already assumed everywhere and never
written down. RAM binds first; disk is the backstop.

**Stranger handling is the node's policy question**, not a relay shortfall.

## Build sequence — scaffolding before optimization

> **Andy (2026-09-19):** *"The migration of persistent datasets to SQLite
> should happen early, since those things will change little before relay
> ships as desired. So when we later mess with lever-inventions etc., a
> stable infrastructure is already stable."* — *"Hints and the relay
> broadcast streaming new connections to nodes must come early, so that
> the current contacts files on the nodes slowly accumulate 'valid' data,
> and so that the relay development can deal with a relatively complete
> behaviour of nodes."* — *"So all the scaffolding comes before intense
> relay optimization."* — *"The other scaffolding element is the visual
> monitor for the owner. Then lever-integration pattern will become
> routine."*

**Decided: scaffolding first, optimization after.** Scaffolding is what every
later cycle stands on — complete node behaviour on the wire, stable storage,
a secure bootstrap, the owner's visual monitor. Optimization is levers,
shares and Governor tuning, and it is only meaningful against the finished
shape.

| kind | cycle | what | status |
|---|---|---|---|
| done | 0 | node and relay as separate startup modules | done, `4d32104` |
| done | 1 | configuration, connection allowance, one-lever Governor, monitor rows | checkpoint, `c67ab1e`; live run moved to optimization |
| scaffolding | 2 | **route hints end to end** — the relay accepts the hint, the node sends it, contacts store relay IDs; route announcements fill contacts | **locked in — next** (Andy) |
| scaffolding | 3 | **SQLite** for the member roll, invites and **partner roll** (its own table in the §5 shape, today's partnerships imported as `partnered`; identity, allow, config stay files) — **and RAM becomes a client of disc** (amended, Andy): disc is the only copy; RAM holds only what current activity needs — connected members, rows a packet or query just touched, the monitoring reservation. The seven whole-roll reads in `relay.js` become queries, search the largest. Verified by a 10,000-member roll running at about the heap of a 10-member one. **The owner's first-claim token** and the installer | agreed (Andy) |
| scaffolding | 4 | **the owner's visual monitor**, generic over levers — any lever in the report is drawn with position, floor, share and last move, so a new lever needs no UI work — **and the lever configuration API** beside it (§5): the monitor shows a lever, the API moves one that declares itself live. **Planned 2026-09-19** as the Relay Monitor app (§4) and the lever object (§10), in pieces 4.1–4.6 | agreed (Andy); 4.1 next |
| scaffolding | 5 | **partner acquisition**, the §5 model, **with the partner-to-partner API** (describe, propose/consent, terms); partner roll born in SQLite. **Its first piece, 5.1, is the vouch** (§6), before alpha | agreed (Andy) |
| optimization | 6 | **dynamic shares** — fixed owner reservation, shares recomputed on connect/disconnect, fixed caps converted (§10) | |
| optimization | 7 | DISC allotments; cycle 1's live run; Governor learning | |
| optimization | — | **a search index**, a learning cycle after the scaffolding exists (Andy, 2026-09-19). Today search walks the roll a page at a time, which does not block but grows with the roll. Options: FTS5 trigram (keeps matches inside a word, 3+ characters, more disc); a `member_tokens(token, publicKey)` table or FTS5 words (starts-with per word, one seek per word, any word count); five indexed token columns (the same, but five seeks per word and words after the fifth unsearchable unless labels are capped at five words). In every option gradedSearch still ranks what the index returns, and 1–2 letter queries keep the walk. **Open, and it decides the option:** must matching inside a word (`ann` in `hannah`) stay? `node:sqlite` has FTS5 and trigram (SQLite 3.53.4, Node 24; spirit-3's Node 25 not checked) | |
| before separate shipping | — | version tolerance (§7) | |

**Cycles 2–5 agreed "for now", cycle 2 locked in** (Andy, 2026-09-19).
Cycle 2 closed the same day. **Cycle 3 closed the same day too**: Part A
(disc, RAM its client) and Part B (the owner's token) —
[the cycle](../cycles/2026-09-19-disc-and-owner-token-cycle-3.md). Next in
the sequence is cycle 4, the owner's visual monitor. Part A
also carries **the member who answers learns the route back** (§9b, R9),
which completes cycle 2's route learning in the reverse direction. `seen`
is decided and not yet built.

> **Andy (2026-09-19), on cycle 3:** *"Can we amend cycle 3 to demand that
> storage is actually moved from RAM to DISC, and RAM must become a
> DISC-client?"*

*Amended in place above.* Moving storage while keeping the whole roll
resident would change the storage and not the RAM — the standing rule
(RAM with utmost care) would not be met. Known constraints for the plan:
`node:sqlite` is unflagged only from **Node 22.13** (22.5–22.12 need
`--experimental-sqlite`), so spirit-3's version decides the floor — **spirit-3
runs Node v25.9.0 at `/usr/bin/node`, Ubuntu 24.04.4 (Andy, 2026-09-19)**,
past the floor; v25 is an odd, non-LTS line and the workstation runs 24 LTS,
so moving spirit-3 to 24 is recommended but not required; a live
database has side files (`-wal`, `-shm`) that a file-copy backup or a test
fixture must not catch mid-write (*this corrects that note: cycle 3 chose
the rollback journal, not WAL, so after each commit the data is in
`relay.db` alone — see relayStore.js*); the one-time import keeps the old JSON as
a renamed backup; and until cycle 4's monitor, a read-only dump tool over
SSH replaces `cat routingTable.json`.
The optimization rows stay unordered until the scaffolding is done.

**The lever-integration routine** that the monitor makes possible: declare
the lever's floor and share (§10) → carry its position and last move in the
report → the monitor draws it. Nothing else to build per lever. *(Extended
by cycle 4's planning: declare it, report it, draw it, **prove it** — the
lever contract, §10.)*

**Cycle 4 in pieces** (Andy, 2026-09-19: "break the cycle into more
manageable pieces"), each its own commit:
- **4.1 hello world** — the owner moves one lever (`connections1`) from a
  bare Relay Monitor and watches the relay take it, live.
- **4.2 the contract, found by working the levers** — the generic test
  layer emerges from `connections1` and a second real lever,
  `requestTimeout1` (its bounds discussed at the start of 4.2); `levers.json`
  and clamping.
- **4.3 no roll travels whole** — counts in the report; rolls answer bounded
  questions. *Discovery searching live participants only was pulled out of
  4.3 and done first, on 2026-09-19, as reconciliation (Andy: "I think of
  this as reconciliation"): the search walk is over the connected members'
  rows in RAM (relay.js `walkRoll`), rows carry no `present`, and the roll
  is no longer paged off disc at all.*
- **4.4 triage** — the cadence switch, `All`, the ranking module.
- **4.5 dialogs** — `consequence`; the traffic dialog.
- **4.6 deprecation** — D9 (natterDetails' monitor rows), D10 (the old
  partner form), and deleting the dead partner picker (it read the census).
- **Then cycle 5.1, the vouch** (§6), before alpha.
- **And the node daemon, its own small cycle, before beta** — the personal
  node runs unattended or the rules above are only true where somebody
  remembered to start it (decided 2026-09-19, see "the node pays
  attention" among the principles).

### Anticipated, and where it sits

Every problem this planning anticipated, placed against the sequence —
where, not how. The goal it points at: **the most robust, self-reliant relay
network we can implement.**

| stage | anticipated problem |
|---|---|
| cycle 4 | rolls passing the payload (answered: counts, bounded questions); network-wide triage without the relay selecting; hub.js still reading `census.roster` — *traced and answered 2026-09-19: the sweep it fed had pruned every member contact since the census went; deleted, with adoption moved onto the claim event* |
| cycle 5 | partners chosen by relays inside the owner's admitted set; the minting cycle; the partner-to-partner API; the old promotion model and the dead picker going |
| Governor / tuning | the timeout floor measured; waits nesting; a deadline travelling with the request; the fan-out's own budget tier; the ranking learned; refusal paths seen live (exit 78, `check_started`) |
| learning cycles | a search index (mostly dissolved by searching live participants); last-active per member; the flush of longest-inactive; trends kept on the node |
| protocol, unplaced | peerPut (a receipt that answers at once, the answer as its own post); broadcasting the route back to other members; the phone's direct grant |
| node daemon, before beta | starting at boot and surviving logout; Windows with no console; one instance per person; a disc bound for what a node keeps unattended |
| before separate shipping | version tolerance (§7) — already arriving through levers |
| harness hygiene | suites leaving temporary folders; lab clones on old code |
| decided, small, unplaced | `seen` on routes, hints ordered by it |

Robustness keeps returning to one pattern: bound it, measure it, then let
the Governor act inside the bound. Scaffolding (cycles 4–5) is where the
network becomes observable and self-managing; everything after it is the
network learning to use that.

**Decided (Andy, 2026-09-19): the relay broadcasts, the node filters.**

> **Andy:** *"So relay should broadcast as specified. Isn't it the node who
> has to know if it holds a contact with that ID?"*

*This settles the open item that stood here.* A proven route is broadcast to
every connected member, as built; each node keeps it only if it already
holds that key as a contact (`contacts.learnRoute`, which never creates a
row) and drops it otherwise. Scoping at the relay was never possible — it
would need the relay to know members' contacts, which never leave the node —
and it is not the relay's question: *whose contact is whose* belongs to the
node, like stranger handling (§2). The cost is connected members × proven
forwards; if it ever binds, deduplicating per route over a window is an
optimization, not a scaffolding change.

Presence broadcast (`present` true/false to every member) is the same shape
and the same answer.

## Recommended, not decided

**Build order.** *Superseded by the build sequence above; kept as the record.* *Superseded 2026-09-19 by the cycle 1 scope in Decided
(RAM limit, cheap counts, simple Governor, simple monitor). Kept as the
record:*

1. ~~**RAM limits** (§8)~~ — now cycle 1.
2. ~~**Reserve monitoring out of it** (§9)~~ — deferred.
3. ~~**DISC_LIMIT**~~ — deferred.
4. ~~**Draw the two monitor panels**~~ — now cycle 1.

**Amendments this sitting proposes to existing decisions**, and the reason
they are listed separately: each changes a rule rather than adding one, and
none is mine to take.

- ~~**0012 / 0013** — from *"never persisted"* to "no fetched term, and no
  stored referrer."~~ **Withdrawn 2026-09-19:** routes are the node's, so
  the relay persists none and "never persisted" stands.
- **0012's partner vocabulary** — from two words (`search`, `forward`) to
  those plus management verbs (§5). The member-list ban is untouched.
  **Approved by Andy 2026-09-19; recorded in 0012.**
- **0013's resource table** — a fourth row. Disk sits second.
- **0007** — *earn its keep* cannot be settled from a ranking. It needs the
  cost model, which is market research and lives elsewhere, dated.

**Structural.**

- Partnerships move to `partners.json` keyed by relay key, as PARTNERS.md
  already specifies — which removes the membership requirement *and* the
  scan.
- Inject the candidate reach the way `askPartner` is injected, so `relay.js`
  keeps its no-outbound property.
- ~~Two stores, not one~~ — *its main case was the route cache, withdrawn
  2026-09-19; see §8, backup.*
- `node:sqlite` is a core module, so the index needs no foreign dependency —
  only an engines floor of 22.5, and it can be the relay's floor alone.

## Open

- **Version tolerance** (§7) — the cost of the evolution split, and the one
  thing that gets harder the longer it is left.
- ~~**The route hint has no place on the wire**~~ — **resolved by cycle 2**
  ([the cycle](../cycles/2026-09-19-route-hints-cycle-2.md)): signed hints
  beside the packet, the relay choosing one partner, the node sending them
  from its contacts' `routes`.
- ~~**MAX_TEXT through a partner is untested**~~ — **resolved for posts by
  cycle 2** (`limits.fitsWrapped`, checked at compose and before carrying;
  Andy's suspicion was right — a near-cap quote-dense packet would have
  413'd at the far hop). **Still open for replies** crossing back.
- **"Capable of partnership" has nothing on the wire to check** (§5). The
  census the old handshake used is gone; the answer is probably the same
  thing §7 needs — a box saying what it speaks.
- **The partner interface's verbs** (§5) — the objective is decided; the
  list is a recommendation.
- **The rate gate on unsolicited partner proposals** (§5) — its floor and
  ceiling.
- **Expiry must be recoverable.** *Drop after N months* plus invite-only is
  permanent exclusion for somebody whose only offence was a quiet season.
  Answer before the lever is built.
- **Roll pressure is a three-way choice, and only two parts are decisions.**
  Expiry is slaved to the allotment, so shorter tenure happens by itself;
  what remains is whether to throttle inflow or buy disk. *Growth compresses
  tenure* is the property to warn an owner about.
- **An owner who is away** loses decisions past the buffer, and §4's
  acceptance test is that an owner can watch a lever move and disagree —
  by changing the programming.
- **One tree or two.** Divergent evolution in one repository is a
  discipline; in two it is a fact. **First step decided (Andy, 2026-09-19):
  node and relay become separate startup modules** instead of one `server.js`
  with `--relay` — narrower than a repo split, and in line with reducing the
  relay's RAM and disc footprint: a relay stops loading node code at all.
  **Built 2026-09-19 (cycle 0):** `js/relayServer.js` and `js/serveCommon.js`;
  `node js/server.js --relay` hands off to the relay module before loading
  anything. Measured by booting each mode and reading `require.cache`: relay
  **30 → 22 modules**, node **32 → 26**. *This corrects the static count
  that stood here, which named only `relayAuth`, `deviceAuth`, `labelRule`
  and constants as shared:* the relay also loads `peerPost`, `partnerLink`,
  `relayRequest`, `sseClient` — and, through `peerPost`, the node-side
  `contacts.js` and `nodeCard.js`. That last pair is the next thing a
  separation has to answer.
  One repo holding both products is the recommendation until either side
  gets its own release clock; repos are not decided.
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
