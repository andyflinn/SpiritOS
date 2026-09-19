# 0012 — A relay never asks for a member list

**Decided 2026-09-17. Against `86b6fe2`. Widened 2026-09-18, amended 2026-09-19 — see below.**

> The get-complete-member-list could be dropped altogether. That's the slimmest
> initial load guaranteed at startup, with no instant explosive growth. (Andy)

## The decision

**There is no verb by which one relay can ask another for its members, and there
will not be one.** Not refused, not bounded, not paginated, not owner-only —
**absent**. The partner vocabulary is two words: `search` and `forward`.
*(Amended 2026-09-19: the vocabulary grows by partnership-management verbs —
see the end of this record. The ban on a member-list verb is unchanged.)*

This supersedes Grok's ruling of the same day, *"refuse member roll"*. Refusing
leaves the verb in the vocabulary, and **a refused verb is one somebody writes a
bounded version of in six months**, with a good reason and a small limit, and
then the limit is raised once.

## Widened, 2026-09-18: nobody is served one either

> **Andy:** *"there is absolutely no reason for unbound entities to conduct
> surveys of our network."* — *"no node is entitled to a full member list from
> a relay."* — *"because the decision is: **entire enrolment lists are NOT
> necessary**."*

The rule above is about one relay asking another. The same rule holds in every
direction, and this is now the decision rather than an implication of it:

> **No party may ASK for an entire enrolment list — not a stranger, not a
> member, not the owner.** There is no door at which "tell me everything"
> is a question, and no bounded, paginated or owner-only version of one.

Three things follow, and they were each a live feature when this was written:

- **`GET /api/relay/who`'s whole-census form** — public, unsigned, unbounded.
  Named a cheat in [0010](0010-fix-the-protocol-or-name-the-cheat.md) the
  same day, and being eradicated per
  [SURFACE.md](../relay/SURFACE.md) §10.
- **`streamRoster`'s member list**, which sends every member's key and label
  to every member on connect. Under the correction below this is **not**
  condemned as a broadcast — but it is the one place a whole list still
  crosses in a single message, and its stated justification (*"the key is
  already public at /api/relay/who"*) goes with the census. Best read as the
  deltas a joining node missed; **open**, and named in
  [SURFACE.md](../relay/SURFACE.md) §10.
- **The owner's roster.** The auto-contacts feature — *"when someone binds
  to a peer i own, it's because i want them in my network, so i want a
  contact auto-generated"* — wanted the membership of a relay its operator
  runs, **by fetching it**. Owning the box does not make a bulk question
  necessary. But it does not need one: a **member-added broadcast** gives the
  owner's node exactly this, as it happens, and gives it to every member's
  node too — *"can add the new member, put it in a queue for acquisition, or
  disregard it."* The feature keeps its purpose and loses its fetch.

**Not "bounded", not "paginated", not "owner-only".** Each is the refusal
this decision already rejected wearing a different sleeve, and a narrower
cheat is a defended one.

### But a broadcast is not a list — corrected 2026-09-18, same day

An earlier draft of this section read *"not by request and not by
broadcast"*, on the reasoning that a list arriving unasked is the same
disclosure as one arriving on request. **That is wrong, and it collapsed the
thing this decision is actually about.**

> **Andy:** *"the working relay will broadcast useful information to its
> membership. Members can filter/use that, because bandwidth is generally
> cheap. A route is established and verified — that's a broadcast. A member
> is added — broadcast it. The member node that is actively listening can
> add the new member, put it in a queue for acquisition, or disregard it.
> Less work for the relay, more up-to-date information for the node."*

What this decision rejects is a **cost shape**, not a disclosure:

| | cost | driven by |
|---|---|---|
| a list on demand | O(members) × per request × per requester | whoever asks, as often as they like |
| a delta broadcast | O(1) per event, one write per listener | **the relay's own business happening** |

A pull is unbounded by anything the relay controls. A push is bounded by the
event rate, which is real activity. So broadcast **satisfies**
[0013](0013-a-relay-is-fixed-cost-per-time-unit.md) rather than evading it,
and the relay is doing less work, not more.

**Membership is not secret from members.** It never was — a member can see
who arrives, and should. What is refused is the bulk question, at any door,
by anyone.

And the incentive runs both ways, which is what makes this hold without
policing:

> **Andy:** *"a node, also looking out for itself, is well advised to listen
> and not waste their request budget (variable) on requests."*

A node's request allowance is scarce and governed
([CAPACITY.md](../relay/CAPACITY.md)). Listening costs it nothing. A node
that fetches a census spends its own budget on information the stream was
handing it free — and under shedding, the one that hammers is dropped before
the one that listens.

What replaces the question in each case is `search` — ask who matches, get
a bounded answer — or nothing, because the caller turned out not to need it.
Five callers were removed between 2026-09-17 and 2026-09-18 and **none
needed a replacement**.

## Why it can go: nobody needs it

It existed so a relay could resolve a key to a partner — the **hint list**,
`members × ~460 B` per partner, described earlier in `relay/PARTNERS.md`.

Two changes the same day removed every caller:

**1. A forwards to B; it does not route to B's member.** The corrected framing
is `N1 → A → B → N2`, where A's request to B says *"forward this to your member
K"*. So **A never has to know that B has K** — B knows. There is nothing to
look up, so there is no list to look it up in.

**2. The route comes from the node, not from the relay.** A search row already
carries the partner's URL (`hub.js` resolves `via` → a URL before the row
reaches the browser), and *"one route is the floor, the list is the point"* in
`PARTNERS.md` has the node persisting routing options and supplying them. **That
job moved off the relay, and the hint list did not notice.**

## Why it must go: demand, and structure

**It fails the test in `CAPACITY.md`, decided item 0** — *a relay spends nothing
in anticipation*. A member list is memory consumed before anybody asked for
anything, on the chance that somebody will. Everything else a relay holds is the
trace of a real request: a route while a post is in flight, a presence entry
while a socket is open.

**And it makes an existing rule structural rather than enforced.** *"A relay
never persists a partner's members"* has been policy since 2026-09-15 — a thing
a reviewer had to remember. It is now a fact about the protocol: **no verb could
deliver them.** That is the same shift the one-hop rule gets from `propagate =
!fromPartner` — a rule that cannot be broken needs nobody to police it.

## Impact on load

The figures are `PARTNERS.md`'s own, measured against the live box: spirit-3
answers 9 rows in 1390 bytes, so ~154 B/row as JSON, ~460 B/row held as objects.
spirit-3 is a **~1 GB VPS**.

**What the hint list would have cost, and now cannot:**

| partners | members each | held rows | one hop |
|---|---|---|---|
| 10 | 100 | 1 000 | 462 KB |
| 50 | 500 | 25 000 | 12 MB |
| 100 | 1 000 | 100 000 | 46 MB |

**All of it becomes zero.** Not smaller — the `partners × members` term does not
appear anywhere, at any hop count, so it cannot be reintroduced by a later
optimisation without adding a verb that this decision says does not exist.

**What a relay holds instead:**

| | before | after |
|---|---|---|
| at boot | own members **+ every partner's members** | own members |
| per partner added | `members × ~460 B` | one row in `partners.json`, one held stream |
| steady state, spirit-3 | 9 rows + partners' rows | **9 rows ≈ 4 KB** |
| growth as the mesh grows | linear in *other people's* membership | **none** |

The last row is the one that matters. Before this, **a relay's memory was a
function of decisions other people made** — a partner enrolling five hundred
members enlarged your box, and you found out by running out. After it, a relay's
footprint is a function of its own membership and its own traffic, both of which
its owner can see.

It also removes the only startup cost that was not bounded by a local number:
**boot is `O(own members)`**, always, whatever the mesh is doing.

## What it costs

**A cold post with no route becomes a hunt.** If the node cannot name the relay,
A must ask each partner *"do you hold K?"* — N small questions on the bus that
already exists, bounded by partner count (~19 in the worked example), rather
than one local lookup.

That is **latency, not memory**, and it is the state `PARTNERS.md` already calls
safe: *"memory pressure degrades performance, not connectivity. A relay that
sheds every hint list it holds still routes everywhere it did; it is just slower
and chattier while it does."* Dropping the roll means **always** operating in
the mode the shedding policy was designed to fall back to — so the fallback path
is now the only path, and gets exercised rather than rotting.

It is also the uncommon path and getting less common: the node persists routes,
so the hunt happens for a peer nobody has posted to before.

## What it does not change

- **Search is untouched.** It is a *question*, not a transfer — bounded at 32
  slots, candidates rather than a list. The thing this decision forbids is
  bulk, not enquiry.
- **Nothing becomes more private.** Every census is public in full at
  `/api/relay/who`; anyone who wants a partner's membership can fetch it as a
  stranger. What is refused is a relay **holding** it, which is 0006's
  distinction between a register and a custodian.
- **Partnering still costs almost nothing when idle** — one row and one stream —
  which is what makes two relays on one VPS reasonable
  (`CAPACITY.md`, decided item 8).

## Amended by 0013 — "does not appear anywhere" is too strong

This decision says the `partners × members` term **does not appear anywhere, at
any hop count**. [0013](0013-a-relay-is-fixed-cost-per-time-unit.md) permits a
relay to hold a **working set** of routes in RAM — keys its own members asked
about — which is a bounded form of that term. The sentence should read: **no
stored term, and no verb that fetches one.**

The distinction is what both decisions rest on:

- **never persisted** — a relay that reboots is re-primed by its members' next
  requests, so boot stays `O(own members)`;
- **never fetched as a roster** — there is still no verb that delivers a
  partner's members, which is this decision's structural guarantee intact;
- **bounded by member demand**, not by partner membership — so it is a function
  of this relay's own members, which is what 0013's invariant permits.

## Related

- **0006** — nothing is stored on a relay on anyone's behalf. This removes the
  last thing a relay would have held that was about somebody else.
- **0007** — a relay survives and earns its keep. Its survival no longer depends
  on other owners' membership decisions.
- `relay/PARTNERS.md` — the retraction of the "four gates", the two-verb build
  list, and the memory model these figures come from.
- `relay/CAPACITY.md` — decided item 0 (demand), item 8 (declared budget),
  item 10 (this decision's working).

## Amended 2026-09-19 — management verbs join the vocabulary

**Decided (Andy, 2026-09-19).** Relays manage their own partnerships
([NODE-AND-RELAY.md](../principles/NODE-AND-RELAY.md) §5), and two words of
traffic cannot do that. The partner vocabulary grows by **management verbs** —
*describe* (what this box is and speaks), *propose / consent* (both owners sign
a partnership), and *terms* (the current cap, carried on replies). The exact
list is still a recommendation there; the objective is decided.

**Unchanged:** there is no verb that asks for a member list, and none that
serves one. Every new verb is a key in a body on the one partner bus, never a
new route or channel (PARTNERS.md).
